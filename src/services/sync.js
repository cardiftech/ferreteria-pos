import db from './db';
import { api } from './api';

const SYNC_KEY = 'lastSync';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

export async function getLastSyncTime() {
  const meta = await db.syncMeta.get(SYNC_KEY);
  return meta?.value ?? null;
}

export async function shouldSync() {
  const last = await getLastSyncTime();
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > SYNC_INTERVAL_MS;
}

export async function syncInventory() {
  const { data, timestamp, count } = await api.getInventory();

  if (!Array.isArray(data)) {
    throw new Error('Formato de inventario inválido recibido del servidor');
  }

  await db.transaction('rw', db.inventory, db.syncMeta, async () => {
    await db.inventory.clear();
    await db.inventory.bulkPut(data);
    await db.syncMeta.put({ key: SYNC_KEY, value: timestamp });
  });

  return { timestamp, count };
}

export async function updateLocalProduct(product) {
  return db.inventory.put(product);
}

export async function getLocalInventory() {
  return db.inventory.toArray();
}
