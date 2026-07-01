/**
 * useStockCoverage — porcentaje del catálogo que ya tiene existencias cargadas.
 *
 * Devuelve { total, withStock, withoutStock, pct }:
 *   • total        — productos en el inventario
 *   • withoutStock — productos con Stock_Actual <= 0 (no vendibles aún)
 *   • withStock    — total - withoutStock
 *   • pct          — % con stock (entero 0-100), o null si aún no hay inventario
 *
 * Usa liveQuery con .count() indexado (índice Stock_Actual — bajo consumo de
 * memoria, no deserializa los 16k+ productos) y se actualiza tras cada sync,
 * venta o restock.
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
      const total = await db.inventory.count();
      // Cuenta sobre el índice Stock_Actual (belowOrEqual) en vez de un filtro JS:
      // no deserializa los 16k+ productos. Importa porque este liveQuery se recalcula
      // en cada venta (decrementLocalStock escribe stock) y está montado en dos
      // lugares a la vez (subtítulo de la navbar + banner del POS).
      const withoutStock = await db.inventory
        .where('Stock_Actual')
        .belowOrEqual(0)
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
