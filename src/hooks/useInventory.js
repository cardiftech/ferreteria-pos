import { useState, useEffect, useCallback } from 'react';
import db from '../services/db';

export function useInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.inventory.toArray();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { products, loading, reload };
}
