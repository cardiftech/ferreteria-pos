import db  from './db';
import { api } from './api';

const SYNC_KEY         = 'lastSync';
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hora — sincroniza al abrir si pasó más de 1h

/** Prefijo de IDs para clientes creados sin conexión.
 *  Exportado para que POS.jsx y otros componentes lo usen sin magic strings. */
export const LOCAL_ID_PREFIX = 'LOCAL-';

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
  const rawBarCode = String(p.Bar_code ?? '').trim();
  const barCode    = rawBarCode
                  || String(p.Codigo   ?? '').trim()
                  || String(p.Clave    ?? '').trim();
  return {
    ...p,
    Bar_code:        barCode,
    // true cuando Sheets no tiene Bar_code real → el PK viene del Codigo/Clave.
    // Usado en la UI para distinguir "código interno" de "código de barras real".
    _isFallbackKey:  rawBarCode === '',
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

  // ── Deduplicación inteligente ────────────────────────────────────────────────
  // Cuando varios productos comparten el mismo Bar_code (barcode de categoría o
  // error de captura en Sheets), en lugar de descartar todos salvo el último,
  // les asignamos claves únicas para que todos sean localizables en el POS:
  //   1. Si el producto tiene Codigo propio → usar Codigo como clave.
  //   2. Si no tiene Codigo → clave sintética "barcode:Descripcion".
  // Los productos sin duplicados se comportan exactamente igual que antes.
  //
  // Limitación aceptada: ventas de productos con clave sintética no decrementan
  // stock en Sheets (el GAS no puede encontrar la fila por esa clave). El POS
  // local sí funciona correctamente. La solución definitiva es asignar barcodes
  // o Codigos únicos en Sheets.

  // Paso 1: contar cuántas veces aparece cada Bar_code
  const barCodeCount = new Map();
  for (const p of allProducts) {
    barCodeCount.set(p.Bar_code, (barCodeCount.get(p.Bar_code) || 0) + 1);
  }

  // Paso 2: deduplicar, rescatando duplicados con claves únicas
  const seen = new Map();
  for (const p of allProducts) {
    const isDupe = (barCodeCount.get(p.Bar_code) || 1) > 1;
    const codigo = String(p.Codigo ?? '').trim();

    let effectiveKey, stored;
    if (isDupe && codigo) {
      // Duplicado con Codigo → usar Codigo como clave (igual que productos sin barcode)
      effectiveKey = codigo;
      stored = { ...p, Bar_code: codigo, _isFallbackKey: true };
    } else if (isDupe) {
      // Duplicado sin Codigo → clave sintética "barcode:Descripcion"
      effectiveKey = `${p.Bar_code}:${String(p.Descripcion ?? '').trim()}`;
      stored = { ...p, Bar_code: effectiveKey, _isFallbackKey: true };
    } else {
      effectiveKey = p.Bar_code;
      stored = p;
    }

    if (seen.has(effectiveKey)) skippedDupe++;
    seen.set(effectiveKey, stored);
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

    // Lee los LOCAL-* ANTES de la transacción para evitar race conditions:
    // syncPendingClients() puede eliminar y re-agregar entradas LOCAL-* justo
    // antes de que corramos, y hacer esta lectura dentro del lock sería más lento.
    const localPending = await db.clients
      .filter(c => String(c.ID_Cliente).startsWith(LOCAL_ID_PREFIX))
      .toArray();

    await db.transaction('rw', db.clients, async () => {
      await db.clients.clear();
      await db.clients.bulkPut([...clean, ...localPending]);
    });
  } catch (err) {
    console.warn('[syncClients]', err);
    // Clientes son opcionales — no romper si la hoja no existe aún
  }
}

/**
 * Sube al servidor los clientes guardados offline (ID_Cliente con prefijo LOCAL-).
 * Debe llamarse ANTES de syncClients para que el servidor asigne IDs reales
 * antes de que la lista fresca de Sheets llegue al cliente.
 */
export async function syncPendingClients() {
  try {
    const pending = await db.clients
      .filter(c => String(c.ID_Cliente).startsWith(LOCAL_ID_PREFIX))
      .toArray();
    if (pending.length === 0) return;

    // Sube cada cliente al servidor y acumula los cambios exitosos
    const toDelete = [];
    const toPut    = [];
    for (const c of pending) {
      try {
        const result = await api.addClient({
          Nombre:      c.Nombre,
          Telefono:    c.Telefono,
          Tipo_Precio: c.Tipo_Precio,
        });
        if (result?.error || !result?.ID_Cliente) {
          console.warn('[syncPendingClients] Servidor rechazó cliente:', result?.error);
          continue;
        }
        toDelete.push(c.ID_Cliente);
        toPut.push(normalizeClient({ ...c, ID_Cliente: result.ID_Cliente }));
      } catch (err) {
        // Deja este cliente para el próximo sync — no bloquea el resto
        console.warn('[syncPendingClients] No se pudo subir cliente', c.ID_Cliente, err);
      }
    }

    // Escribe todos los cambios en una sola transacción — 2 ops en lugar de 2N
    if (toDelete.length > 0) {
      await db.transaction('rw', db.clients, async () => {
        await db.clients.bulkDelete(toDelete);
        await db.clients.bulkPut(toPut);
      });
    }
  } catch (err) {
    console.error('[syncPendingClients]', err);
    throw err; // Propaga para que AppContext pueda notificar si hace falta
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
