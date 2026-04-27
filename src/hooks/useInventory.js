import { useState, useEffect, useCallback, useRef } from 'react';
import { liveQuery } from 'dexie';
import db from '../services/db';

/**
 * Hook de inventario con doble estrategia:
 * 1. liveQuery — reactivo a cualquier escritura en IndexedDB (p.ej. bulkPut del sync)
 * 2. reload() — carga directa; se llama desde Inventory.jsx tras guardar/editar
 *    y también desde AppContext cuando sync termina, para garantizar datos frescos
 *    incluso si liveQuery falla en StrictMode de React 18.
 */
export function useInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const mounted = useRef(true);

  // Carga directa desde IndexedDB
  const reload = useCallback(async () => {
    try {
      const data = await db.inventory.toArray();
      if (mounted.current) { setProducts(data); setLoading(false); }
    } catch (err) {
      console.error('[useInventory] reload error:', err);
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Carga inicial + escucha el evento de sync completado
  useEffect(() => {
    mounted.current = true;
    reload();
    window.addEventListener('ferrepos:synced', reload);
    return () => {
      mounted.current = false;
      window.removeEventListener('ferrepos:synced', reload);
    };
  }, [reload]);

  // liveQuery como capa reactiva sobre liveQuery
  // Si falla o no dispara (StrictMode), reload() cubre el caso
  useEffect(() => {
    let sub;
    try {
      sub = liveQuery(() => db.inventory.toArray()).subscribe({
        next: (data) => {
          if (mounted.current) { setProducts(data); setLoading(false); }
        },
        error: (err) => {
          console.error('[useInventory] liveQuery error:', err);
          // Fallback: lectura directa si liveQuery falla
          reload();
        },
      });
    } catch (err) {
      console.error('[useInventory] liveQuery setup error:', err);
    }
    return () => { sub?.unsubscribe?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { products, loading, reload };
}
