/**
 * useStockCoverage — porcentaje del catálogo que ya tiene existencias cargadas.
 *
 * Devuelve { total, withStock, withoutStock, pct }:
 *   • total        — productos en el inventario
 *   • withoutStock — productos con Stock_Actual <= 0 (no vendibles aún)
 *   • withStock    — total - withoutStock
 *   • pct          — % con stock (entero 0-100), o null si aún no hay inventario
 *
 * Usa liveQuery con .count() sobre un cursor de Dexie (bajo consumo de memoria,
 * no carga los 16k+ productos) y se actualiza solo tras cada sync o restock.
 */
import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import db from '../services/db';

export function useStockCoverage() {
  const [coverage, setCoverage] = useState({
    total: 0, withStock: 0, withoutStock: 0, pct: null,
  });

  useEffect(() => {
    const sub = liveQuery(async () => {
      const total        = await db.inventory.count();
      const withoutStock = await db.inventory
        .filter(p => Number(p.Stock_Actual) <= 0)
        .count();
      return { total, withoutStock };
    }).subscribe({
      next: ({ total, withoutStock }) => {
        const withStock = Math.max(0, total - withoutStock);
        const pct = total > 0 ? Math.round((withStock / total) * 100) : null;
        setCoverage({ total, withStock, withoutStock, pct });
      },
      error: () => {},   // silencioso — el subtítulo simplemente no muestra el %
    });
    return () => sub.unsubscribe();
  }, []);

  return coverage;
}
