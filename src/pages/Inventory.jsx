import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, RefreshCw, Search, ScanLine } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useInventory }          from '../hooks/useInventory';
import { useSearch }             from '../hooks/useSearch';
import { useApp }                from '../context/AppContext';
import { api }                   from '../services/api';
import { updateLocalProduct }    from '../services/sync';
import ProductTable              from '../components/inventory/ProductTable';
import ProductForm               from '../components/inventory/ProductForm';
import BarcodeScanner            from '../components/pos/BarcodeScanner';

const PAGE_SIZE = 50; // más grande → menos carga de IntersectionObserver

export default function Inventory() {
  const [query, setQuery]       = useState('');
  const [editProduct, setEdit]  = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('new');
  const [saving, setSaving]     = useState(false);
  const [visible, setVisible]   = useState(PAGE_SIZE);
  const [scanInventory, setScanInventory] = useState(false);
  const sentinelRef = useRef(null); // elemento centinela para IntersectionObserver

  const { products, loading, reload } = useInventory();
  const { notify, state, sync }       = useApp();

  // Debounce: no ejecuta Fuse en cada tecla → espera 200 ms sin escribir
  const debouncedQuery = useDebounce(query, 200);
  const results = useSearch(products, debouncedQuery);

  // Reiniciar paginación al cambiar búsqueda
  useEffect(() => setVisible(PAGE_SIZE), [debouncedQuery]);

  const shown   = results.slice(0, visible);
  const hasMore = results.length > visible;

  // Infinite scroll: cuando el centinela es visible, carga más filas
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore) setVisible(n => n + PAGE_SIZE); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);
  const lowStockCount = products.filter(
    (p) => Number(p.Stock_Actual) <= Number(p.Stock_Minimo)
  ).length;

  const openEdit  = (p) => { setEdit(p); setFormMode('edit'); setShowForm(true); };
  const openNew   = ()  => { setEdit(null); setFormMode('new'); setShowForm(true); };
  const closeForm = ()  => setShowForm(false);

  const handleInventoryScan = (barcode) => {
    setScanInventory(false);
    const found = products.find(
      (p) => String(p.Bar_code).trim() === barcode.trim()
    );
    if (found) {
      setEdit(found);
      setFormMode('restock');
    } else {
      setEdit({ Bar_code: barcode });
      setFormMode('new');
    }
    setShowForm(true);
  };

  const handleSave = async (data, mode) => {
    if (!state.isOnline) {
      notify('Sin conexión — no se pueden guardar cambios', 'error');
      return;
    }
    setSaving(true);
    try {
      const isNew = mode === 'new';
      const result = isNew
        ? await api.addProduct(data)
        : await api.updateProduct(data);
      if (result?.error) throw new Error(result.error);
      await updateLocalProduct(data);
      await reload();
      const msg = isNew ? 'Producto agregado' : mode === 'restock' ? 'Stock actualizado' : 'Producto actualizado';
      notify(msg, 'success');
      closeForm();
    } catch (err) {
      notify(err.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    try {
      await sync(true);
      await reload();
      notify('Inventario sincronizado', 'success');
    } catch {
      notify('Error al sincronizar', 'error');
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Inventario</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {products.length} productos
            {lowStockCount > 0 && (
              <span className="ml-1.5 text-orange-600 font-medium">
                · {lowStockCount} stock bajo
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={!state.isOnline}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200
                       rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50
                       disabled:opacity-40 transition-colors shadow-sm"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
          <button
            onClick={() => setScanInventory(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200
                       rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50
                       transition-colors shadow-sm"
          >
            <ScanLine size={14} />
            <span className="hidden sm:inline">Escanear</span>
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600
                       rounded-xl text-sm font-semibold text-white transition-colors shadow-sm"
          >
            <Plus size={14} />
            Nuevo
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar productos…"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl
                     text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
        />
      </div>

      {/* Tabla / estados */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
          <p className="text-sm">
            {query ? 'Sin resultados para ese filtro' : 'No hay productos — sincroniza o agrega uno nuevo'}
          </p>
        </div>
      ) : (
        <>
          <ProductTable products={shown} onEdit={openEdit} />

          {/* Centinela para infinite scroll — invisible, detectado por IntersectionObserver */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <p className="text-center text-xs text-gray-400 pb-2">
            Mostrando {shown.length} de {results.length} productos
          </p>
        </>
      )}

      {showForm && (
        <ProductForm
          product={editProduct}
          mode={formMode}
          onSave={handleSave}
          onCancel={closeForm}
          loading={saving}
        />
      )}

      {scanInventory && (
        <BarcodeScanner
          onScan={(barcode) => handleInventoryScan(barcode)}
          onClose={() => setScanInventory(false)}
          cartCount={0}
          cartTotal={0}
          onCheckout={() => setScanInventory(false)}
        />
      )}

    </div>
  );
}
