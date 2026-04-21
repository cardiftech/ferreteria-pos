import { useMemo } from 'react';
import Fuse from 'fuse.js';

const FUSE_OPTIONS = {
  keys: [
    { name: 'Descripcion', weight: 0.55 },
    { name: 'Bar_code',    weight: 0.25 },
    { name: 'Marca',       weight: 0.12 },
    { name: 'Clave',       weight: 0.05 },
    { name: 'Codigo',      weight: 0.03 },
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
    if (trimmed.length === 0) return products;
    if (trimmed.length < 2) {
      return products.filter(p =>
        String(p.Bar_code).startsWith(trimmed) ||
        String(p.Codigo).startsWith(trimmed)
      );
    }
    return fuse.search(trimmed).map(r => r.item);
  }, [fuse, query, products]);
}
