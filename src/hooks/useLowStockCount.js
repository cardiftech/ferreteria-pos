/**
 * useLowStockCount — cuenta productos con stock ≤ mínimo sin cargar el array completo.
 * Usa liveQuery para actualizarse automáticamente tras cada sync o restock.
 * El filtro corre sobre un cursor de Dexie (bajo consumo de memoria).
 */
import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';
import db from '../services/db';

export function useLowStockCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sub = liveQuery(() =>
      db.inventory
        // Stock_Minimo > 0 excluye productos sin mínimo configurado (Stock_Minimo = 0),
        // que de otro modo inflarían el badge cuando Stock_Actual también es 0.
        .filter(p => Number(p.Stock_Minimo) > 0 && Number(p.Stock_Actual) <= Number(p.Stock_Minimo))
        .count()
    ).subscribe({
      next:  (n)   => setCount(n),
      error: (_)   => {},   // silencioso — el badge simplemente no muestra nada
    });
    return () => sub.unsubscribe();
  }, []);

  return count;
}
