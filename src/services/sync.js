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

export async function syncInventory() {
  const { data, timestamp, count } = await api.getInventory();
  if (!Array.isArray(data)) throw new Error('Formato de inventario inválido');

  const clean = data.map(normalizeProduct);
  await db.transaction('rw', db.inventory, db.syncMeta, async () => {
    await db.inventory.clear();
    await db.inventory.bulkPut(clean);
    await db.syncMeta.put({ key: SYNC_KEY, value: timestamp });
  });

  return { timestamp, count };
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
