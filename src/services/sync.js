import db from './db';
import { api } from './api';

const SYNC_KEY         = 'lastSync';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 min

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
  return {
    ...p,
    Precio_distribuidor_IVA:  parseNum(p.Precio_distribuidor_IVA),
    Precio_mayoreo_IVA:       parseNum(p.Precio_mayoreo_IVA),
    Precio_medio_mayoreo_IVA: parseNum(p.Precio_medio_mayoreo_IVA),
    Precio_publico_IVA:       parseNum(p.Precio_publico_IVA),
    Stock_Actual:             parseNum(p.Stock_Actual),
    Stock_Minimo:             parseNum(p.Stock_Minimo),
    Almacen_1:                parseNum(p.Almacen_1),
    Almacen_2:                parseNum(p.Almacen_2),
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

const BATCH_SIZE = 2000; // productos por petición al servidor

/**
 * Sincroniza el inventario completo en lotes de BATCH_SIZE.
 * onProgress(loaded, total) se llama tras cada lote para mostrar avance.
 * El primer lote se almacena de inmediato → el usuario puede buscar
 * mientras los demás lotes se descargan en segundo plano.
 */
export async function syncInventory(onProgress) {
  let offset  = 0;
  let total   = null;
  let hasMore = true;
  let firstBatch = true;

  while (hasMore) {
    const result = await api.getInventory({ offset, limit: BATCH_SIZE });

    if (!Array.isArray(result.data)) throw new Error('Formato de inventario inválido');

    // En el primer lote limpiamos la tabla; lotes siguientes solo agregan
    if (firstBatch) {
      await db.inventory.clear();
      firstBatch = false;
    }

    const clean = result.data.map(normalizeProduct);
    await db.inventory.bulkPut(clean);

    offset  += result.data.length;
    total    = result.total ?? total ?? offset;
    hasMore  = result.hasMore === true && result.data.length === BATCH_SIZE;

    onProgress?.(offset, total);
  }

  const ts = new Date().toISOString();
  await db.syncMeta.put({ key: SYNC_KEY, value: ts });
  return { timestamp: ts, count: offset };
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

export async function getLocalInventory() {
  return db.inventory.toArray();
}
