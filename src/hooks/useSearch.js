/**
 * useSearch — async, worker-based product search.
 *
 * Fuse.js runs inside a Web Worker so the main thread (UI) is never blocked
 * while indexing or searching 15 k+ products.
 *
 * Returns { results, truncated, total }
 *  • results   — full product objects matching the query (max 80)
 *  • truncated — true when more than 80 matches exist
 *  • total     — actual match count before truncation
 *
 * Empty query → returns the full products array (no worker call needed).
 */
import { useState, useEffect, useRef } from 'react';

// ── Singleton worker (shared across all hook instances) ────────────────────────
let _worker     = null;
let _listeners  = new Set();

function getWorker() {
  if (!_worker) {
    _worker = new Worker(
      new URL('../workers/search.worker.js', import.meta.url),
      { type: 'module' },
    );
    _worker.onmessage = (e) => {
      _listeners.forEach(fn => fn(e.data));
    };
  }
  return _worker;
}

// ──────────────────────────────────────────────────────────────────────────────
export function useSearch(products, query) {
  const [results,   setResults]   = useState(products);
  const [truncated, setTruncated] = useState(false);
  const [total,     setTotal]     = useState(products.length);

  // Monotonically-increasing request id — stale responses are discarded
  const reqIdRef      = useRef(0);
  // Map<Bar_code, product> for fast lookup when worker returns bar codes
  const productMapRef = useRef(new Map());

  // Keep the product map in sync whenever the inventory changes
  useEffect(() => {
    const map = new Map();
    for (const p of products) map.set(p.Bar_code, p);
    productMapRef.current = map;
  }, [products]);

  // Send slim product list to worker whenever inventory changes
  useEffect(() => {
    if (products.length === 0) return;
    const slim = products.map(({ Bar_code, Codigo, Clave, Descripcion }) => ({
      Bar_code, Codigo, Clave, Descripcion,
    }));
    getWorker().postMessage({ type: 'SET_PRODUCTS', products: slim });
  }, [products]);

  // Subscribe to worker results
  useEffect(() => {
    const handler = (msg) => {
      if (msg.type !== 'RESULTS') return;
      // Ignore responses from superseded requests
      if (msg.id !== reqIdRef.current) return;

      if (msg.barCodes === null) {
        // Worker signals "empty query" — return full list from main thread
        setResults(products);
        setTruncated(false);
        setTotal(products.length);
        return;
      }

      // Map bar codes back to full product objects
      const map      = productMapRef.current;
      const resolved = msg.barCodes.map(bc => map.get(bc)).filter(Boolean);
      setResults(resolved);
      setTruncated(msg.truncated);
      setTotal(msg.total);
    };

    _listeners.add(handler);
    return () => _listeners.delete(handler);
  }, [products]); // re-subscribe when products ref changes so closure is fresh

  // Send search request whenever query or products change
  useEffect(() => {
    const trimmed = (query ?? '').trim();

    // Empty query — handle entirely on main thread, no worker round-trip
    if (trimmed.length === 0) {
      ++reqIdRef.current; // invalida cualquier respuesta pendiente del worker
      setResults(products);
      setTruncated(false);
      setTotal(products.length);
      return;
    }

    if (products.length === 0) {
      setResults([]);
      setTruncated(false);
      setTotal(0);
      return;
    }

    const id = ++reqIdRef.current;
    getWorker().postMessage({ type: 'SEARCH', query: trimmed, id });
  }, [query, products]);

  return { results, truncated, total };
}
