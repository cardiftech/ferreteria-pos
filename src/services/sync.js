import db from './db';
import { api } from './api';

const SYNC_KEY         = 'lastSync';
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hora — sincroniza al abrir si pasó más de 1h

export async function getLastSyncTime() {
  const meta = await db.syncMeta.get(SYNC_KEY);
  return meta?.value ?? null;
}

export async function shouldSync() {
  const last = await getLastSyncTime();
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > SYNC_INTERVAL_MS;
}

// Google Sheets puede devolver "$1,250.00" → parseamos a número limpio
function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/[$,\s]/g, '')) || 0;
}

function normalizeProduct(p) {
  // Bar_code es el PK de Dexie. Si está vacío en Sheets usamos Codigo como
  // respaldo (y Clave como último recurso) para que los productos sin código
  // de barras sigan siendo accesibles en el POS y el inventario.
  // El sync hace clear()+bulkPut() completo, así que la clave es siempre
  // consistente. Cuando el usuario agregue el barcode real en Sheets,
  // el siguiente sync lo migra automáticamente al barcode correcto.
  const barCode = String(p.Bar_code ?? '').trim()
               || String(p.Codigo   ?? '').trim()
               || String(p.Clave    ?? '').trim();
  return {
    ...p,
    Bar_code:                 barCode,
    // Codigo_SAT como string para evitar problemas al enviarlo al GAS
    Codigo_SAT:               String(p.Codigo_SAT ?? '').trim(),
    Precio_distribuidor_IVA:  parseNum(p.Precio_distribuidor_IVA),
    Precio_mayoreo_IVA:       parseNum(p.Precio_mayoreo_IVA),
    Precio_medio_mayoreo_IVA: parseNum(p.Precio_medio_mayoreo_IVA),
    Precio_publico_IVA:       parseNum(p.Precio_publico_IVA),
    Stock_Actual:             parseNum(p.Stock_Actual),
    Stock_Minimo:             parseNum(p.Stock_Minimo),
    Local:                    parseNum(p.Local),
    Bodeguita:                parseNum(p.Bodeguita),
  };
}

function normalizeClient(c) {
  return {
    ID_Cliente:  String(c.ID_Cliente  || ''),
    Nombre:      String(c.Nombre      || ''),
    Telefono:    String(c.Telefono    || ''),
    Tipo_Precio: String(c.Tipo_Precio || 'Precio_publico_IVA'),
  };
}

const BATCH_SIZE = 5000; // productos por petición al servidor

/**
 * Sincroniza el inventario completo en lotes de BATCH_SIZE.
 * onProgress(loaded, total) se llama tras cada lote para mostrar avance.
 *
 * ESTRATEGIA SEGURA: descarga TODOS los lotes a memoria primero y solo
 * entonces hace clear() + bulkPut() en una transacción atómica.
 * Si cualquier lote falla (red cortada, error del servidor), el inventario
 * local queda intacto — nunca se queda vacío a la mitad.
 *
 * Devuelve { timestamp, count, skippedEmpty, skippedDupe } para que
 * la UI pueda informar al usuario cuántas filas de Sheets fueron omitidas
 * (sin Bar_code o con Bar_code repetido) y por qué el conteo difiere.
 */
export async function syncInventory(onProgress) {
  let offset      = 0;
  let total       = null;
  let hasMore     = true;
  const allProducts  = [];   // buffer en memoria hasta terminar
  let skippedEmpty   = 0;    // filas sin Bar_code (Dexie no puede guardarlas)
  let skippedDupe    = 0;    // filas con Bar_code repetido (la última gana)

  while (hasMore) {
    const result = await api.getInventory({ offset, limit: BATCH_SIZE });

    if (!Array.isArray(result.data)) throw new Error('Formato de inventario inválido');

    const normalized = result.data.map(normalizeProduct);

    for (const p of normalized) {
      // Solo omitir si no hay ningún identificador (Bar_code, Codigo ni Clave)
      if (p.Bar_code === '') { skippedEmpty++; continue; }
      allProducts.push(p);
    }

    offset  += result.data.length;
    total    = result.total ?? total ?? offset;
    hasMore  = result.hasMore === true && result.data.length === BATCH_SIZE;

    onProgress?.(offset, total);
  }

  // Deduplicar por Bar_code (última fila en Sheets gana, igual que bulkPut)
  // Esto hace que allProducts.length coincida exactamente con lo que Dexie guarda.
  const seen    = new Map();
  for (const p of allProducts) {
    if (seen.has(p.Bar_code)) skippedDupe++;
    seen.set(p.Bar_code, p);
  }
  const unique = Array.from(seen.values());

  // Solo cuando TODOS los lotes están en memoria: escribe atómicamente
  await db.transaction('rw', db.inventory, async () => {
    await db.inventory.clear();
    await db.inventory.bulkPut(unique);
  });

  const ts = new Date().toISOString();
  await db.syncMeta.put({ key: SYNC_KEY, value: ts });
  return { timestamp: ts, count: unique.length, skippedEmpty, skippedDupe };
}

export async function syncClients() {
  try {
    const { data } = await api.getClients();
    if (!Array.isArray(data)) return;
    const clean = data.map(normalizeClient);
    await db.transaction('rw', db.clients, async () => {
      await db.clients.clear();
      await db.clients.bulkPut(clean);
    });
  } catch (_) {
    // Clientes son opcionales — no romper si la hoja no existe aún
  }
}

export async function updateLocalProduct(product) {
  return db.inventory.put(normalizeProduct(product));
}

/**
 * Descuenta stock localmente después de una venta, sin hacer sync completo.
 * items = [{ Bar_code, quantity, warehouse }]
 */
export async function decrementLocalStock(items) {
  for (const item of items) {
    const p = await db.inventory.get(String(item.Bar_code));
    if (!p) continue;
    const qty     = Number(item.quantity) || 0;
    const whKey   = item.warehouse === 'Bodeguita' ? 'Bodeguita' : 'Local';
    await db.inventory.put({
      ...p,
      Stock_Actual: Math.max(0, (Number(p.Stock_Actual) || 0) - qty),
      [whKey]:      Math.max(0, (Number(p[whKey])       || 0) - qty),
    });
  }
}

export async function getLocalInventory() {
  return db.inventory.toArray();
}
