import { useMemo } from 'react';
import Fuse from 'fuse.js';

const FUSE_OPTIONS = {
  keys: [
    { name: 'Producto',      weight: 0.6 },
    { name: 'Codigo_Barras', weight: 0.3 },
    { name: 'Categoria',     weight: 0.1 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
};

export function useSearch(products, query) {
  const fuse = useMemo(() => new Fuse(products, FUSE_OPTIONS), [products]);

  return useMemo(() => {
    const trimmed = query?.trim() ?? '';
    if (trimmed.length < 2) return products.slice(0, 30);
    return fuse.search(trimmed).map((r) => r.item);
  }, [fuse, query, products]);
}
