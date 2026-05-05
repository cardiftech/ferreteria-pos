/**
 * search.worker.js
 * Runs Fuse.js off the main thread so 15k-product searches
 * never block the UI.
 *
 * Protocol:
 *  ← { type: 'SET_PRODUCTS', products: [{Bar_code, Codigo, Clave, Descripcion, PROVEEDOR}] }
 *  ← { type: 'SEARCH', query: string, id: number }
 *  → { type: 'RESULTS', id, barCodes: string[] | null, truncated: bool, total: number }
 *
 * barCodes === null means "empty query — caller should use all products".
 */
import Fuse from 'fuse.js';

const FUSE_OPTIONS = {
  keys: [
    { name: 'Descripcion', weight: 1   },
    { name: 'PROVEEDOR',   weight: 0.6 },
  ],
  threshold:          0.30,
  includeScore:       true,
  minMatchCharLength: 3,
  ignoreLocation:     true,
  useExtendedSearch:  false,
  findAllMatches:     false,
};

const MAX_RESULTS = 80;

let fuse          = null;
let slimProducts  = [];   // [{Bar_code, Codigo, Clave, Descripcion}]

self.onmessage = ({ data }) => {
  // ── Build index ────────────────────────────────────────────────────────────
  if (data.type === 'SET_PRODUCTS') {
    slimProducts = data.products;
    fuse = new Fuse(slimProducts, FUSE_OPTIONS);
    return;
  }

  // ── Run search ─────────────────────────────────────────────────────────────
  if (data.type === 'SEARCH') {
    const { query, id } = data;
    const trimmed = (query ?? '').trim();

    if (trimmed.length === 0) {
      self.postMessage({ type: 'RESULTS', id, barCodes: null, truncated: false, total: 0 });
      return;
    }

    if (!fuse || slimProducts.length === 0) {
      self.postMessage({ type: 'RESULTS', id, barCodes: [], truncated: false, total: 0 });
      return;
    }

    const t = trimmed.toLowerCase();

    // 1. Exact/prefix matches on codes and supplier (these always rank first)
    const exactSet   = new Set();
    const exactCodes = [];
    for (const p of slimProducts) {
      if (
        String(p.Bar_code).includes(trimmed)          ||
        String(p.Codigo).includes(trimmed)             ||
        String(p.Clave).toLowerCase().includes(t)      ||
        String(p.PROVEEDOR).toLowerCase().includes(t)
      ) {
        if (!exactSet.has(p.Bar_code)) {
          exactSet.add(p.Bar_code);
          exactCodes.push(p.Bar_code);
        }
      }
    }

    // 2. Description matches (Fuse for ≥3 chars, startsWith for shorter)
    const descCodes = [];
    if (trimmed.length < 3) {
      for (const p of slimProducts) {
        if (!exactSet.has(p.Bar_code) &&
            String(p.Descripcion).toLowerCase().startsWith(t)) {
          descCodes.push(p.Bar_code);
        }
      }
    } else {
      const fuseResults = fuse.search(trimmed);
      for (const r of fuseResults) {
        if (!exactSet.has(r.item.Bar_code)) {
          descCodes.push(r.item.Bar_code);
        }
      }
    }

    const all = [...exactCodes, ...descCodes];
    self.postMessage({
      type:      'RESULTS',
      id,
      barCodes:  all.slice(0, MAX_RESULTS),
      truncated: all.length > MAX_RESULTS,
      total:     all.length,
    });
  }
};
