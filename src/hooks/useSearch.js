import { useMemo } from 'react';
import Fuse from 'fuse.js';

// ── Optimizado para 15 000+ registros ────────────────────────────────────────
// · Solo 3 claves (menos índices = build más rápido)
// · threshold 0.28 (más estricto → menos candidatos evaluados → más rápido)
// · minMatchCharLength 3 → Fuse no corre con 1-2 chars (usamos filter exacto)
// · limit 80 → devuelve solo los 80 mejores, no recorre todo el array
// · findAllMatches: false → para en la primera coincidencia por string
const FUSE_OPTIONS = {
  keys: [
    { name: 'Descripcion', weight: 0.65 },
    { name: 'Bar_code',    weight: 0.25 },
    { name: 'Marca',       weight: 0.10 },
  ],
  threshold:          0.28,
  includeScore:       true,
  minMatchCharLength: 3,
  ignoreLocation:     true,
  useExtendedSearch:  false,
  findAllMatches:     false,
  limit:              80,   // máximo resultados (evita recorrer los 15k cuando ya hay 80)
};

export function useSearch(products, query) {
  // Fuse construye su índice una sola vez (useMemo = no reconstruye en cada render)
  const fuse = useMemo(() => new Fuse(products, FUSE_OPTIONS), [products]);

  return useMemo(() => {
    const trimmed = query?.trim() ?? '';
    if (trimmed.length === 0) return products;

    // Queries cortas: filtro exacto O(n) instantáneo
    if (trimmed.length < 3) {
      const t = trimmed.toLowerCase();
      return products.filter(p =>
        String(p.Bar_code).startsWith(trimmed) ||
        String(p.Codigo).toLowerCase().startsWith(t) ||
        String(p.Descripcion).toLowerCase().startsWith(t)
      );
    }

    // Queries largas: Fuse fuzzy (limitado a 80 resultados)
    return fuse.search(trimmed).map(r => r.item);
  }, [fuse, query, products]);
}
