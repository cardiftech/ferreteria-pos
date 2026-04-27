/**
 * usePendingSalesCount — cuenta ventas con synced: 0 en IndexedDB.
 * synced: 0 significa que la venta se intentó registrar pero la API falló
 * (corte de red justo durante el request) y nunca se confirmó en GAS.
 * Usa liveQuery para actualizarse automáticamente.
 */
import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import db from '../services/db';

export function usePendingSalesCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sub = liveQuery(() =>
      db.pendingSales.where('synced').equals(0).count()
    ).subscribe({
      next:  (n) => setCount(n),
      error: ()  => {},
    });
    return () => sub.unsubscribe();
  }, []);

  return count;
}
