import { useState, useEffect, useCallback } from 'react';
import db from '../services/db';
import { syncClients } from '../services/sync';

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
    // Sincroniza una vez al montar (sin bloquear)
    if (navigator.onLine) {
      syncClients().then(reload).catch(() => {});
    }
  }, [reload]);

  return { clients, reload };
}
