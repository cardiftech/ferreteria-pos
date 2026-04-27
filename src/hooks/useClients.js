import { useState, useEffect, useCallback } from 'react';
import db from '../services/db';
import { syncClients, getLastSyncTime } from '../services/sync';

const CLIENT_SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hora — igual que el inventario
const CLIENT_SYNC_KEY = 'lastClientSync';

async function shouldSyncClients() {
  const meta = await db.syncMeta.get(CLIENT_SYNC_KEY);
  if (!meta?.value) return true;
  return Date.now() - new Date(meta.value).getTime() > CLIENT_SYNC_INTERVAL_MS;
}

async function markClientSynced() {
  await db.syncMeta.put({ key: CLIENT_SYNC_KEY, value: new Date().toISOString() });
}

export function useClients() {
  const [clients, setClients] = useState([]);

  const reload = useCallback(async () => {
    try {
      const data = await db.clients.toArray();
      setClients(data);
    } catch (_) {
      setClients([]);
    }
  }, []);

  useEffect(() => {
    reload();
    // Sincroniza solo si pasó más de 1h — evita una petición HTTP en cada
    // navegación al POS cuando los clientes ya están frescos en IndexedDB
    if (navigator.onLine) {
      shouldSyncClients().then(needed => {
        if (!needed) return;
        syncClients()
          .then(() => markClientSynced())
          .then(reload)
          .catch(() => {});
      });
    }
  }, [reload]);

  return { clients, reload };
}
