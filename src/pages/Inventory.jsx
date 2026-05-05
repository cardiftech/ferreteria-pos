import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, ScanLine, Download, Clock } from 'lucide-react';
import { useInventory }          from '../hooks/useInventory';
import { useSearch }             from '../hooks/useSearch';
import { useApp }                from '../context/AppContext';
import { api }                   from '../services/api';
import { updateLocalProduct, getLastSyncTime } from '../services/sync';
import db                        from '../services/db';
import SearchInput               from '../components/shared/SearchInput';
import ProductTable              from '../components/inventory/ProductTable';
import ProductForm               from '../components/inventory/ProductForm';
import BarcodeScanner            from '../components/pos/BarcodeScanner';

/** Convierte una fecha ISO a texto relativo: "hace 5 min", "hace 2 h", etc. */
function timeAgo(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} días`;
}

const PAGE_SIZE = 50; // más grande → menos carga de IntersectionObserver

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editProduct, setEdit]        = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('new');
  const [saving, setSaving]     = useState(false);
  const [visible, setVisible]   = useState(PAGE_SIZE);
  const [scanInventory, setScanInventory] = useState(false);
  const [lastSyncLabel, setLastSyncLabel] = useState('');
  const sentinelRef = useRef(null); // elemento centinela para IntersectionObserver

  const { products, loading, reload } = useInventory();
  const { notify, state, sync }       = useApp();

  // Carga el timestamp de la última sync al montar y cuando el estado de sync cambia
  useEffect(() => {
    getLastSyncTime().then(ts => setLastSyncLabel(ts ? timeAgo(ts) : ''));
  }, [state.syncStatus]);

  // searchQuery viene ya debounced (150ms) desde SearchInput
  // → este componente NO re-renderiza en cada tecla
  const { results } = useSearch(products, searchQuery);

  // Callback estable para SearchInput
  const handleSearch = useCallback((val) => setSearchQuery(val), []);

  // Reiniciar paginación al cambiar búsqueda
  useEffect(() => setVisible(PAGE_SIZE), [searchQuery]);

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
  // useMemo evita iterar 16k+ objetos en cada re-render (tecla en buscador, scroll, etc.)
  // Solo se recalcula cuando cambia el array de productos (sync o restock).
  const lowStockCount = useMemo(
    () => products.filter(
      p => Number(p.Stock_Minimo) > 0 && Number(p.Stock_Actual) <= Number(p.Stock_Minimo)
    ).length,
    [products]
  );

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
      // Guarda historial de restock en IndexedDB (no sincroniza con servidor)
      if (mode === 'restock' && editProduct) {
        const oldStock = Number(editProduct.Stock_Actual);
        const newStock = Number(data.Stock_Actual);
        await db.restockHistory.add({
          Bar_code: data.Bar_code,
          date:     new Date().toISOString(),
          delta:    newStock - oldStock,
          oldStock,
          newStock,
        }).catch(() => {}); // no bloquear si falla

        // Limpieza: elimina registros de restock con más de 90 días para no
        // llenar IndexedDB con historial indefinido en uso intensivo.
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        db.restockHistory.where('date').below(cutoff).delete().catch(() => {});
      }
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
    const result = await sync(true); // sync() nunca lanza — devuelve null si hubo error
    await reload();
    if (result) {
      // Mensaje base
      let msg = `Inventario actualizado — ${result.count.toLocaleString('es-MX')} productos`;

      // Si Sheets tenía filas problemáticas, informar claramente
      const omitidos = (result.skippedEmpty ?? 0) + (result.skippedDupe ?? 0);
      if (omitidos > 0) {
        const partes = [];
        if (result.skippedEmpty > 0)
          partes.push(`${result.skippedEmpty} sin identificador`);
        if (result.skippedDupe > 0)
          partes.push(`${result.skippedDupe} con código repetido`);
        msg += ` · ${omitidos} omitidos (${partes.join(', ')})`;
      }

      notify(msg, omitidos > 0 ? 'warning' : 'success');
    }
    // Si result === null, AppContext ya mostró el toast de error; no sobreescribimos
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Inventario</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {products.length.toLocaleString('es-MX')} productos
            {lowStockCount > 0 && (
              <span className="ml-1.5 text-orange-600 font-medium">
                · {lowStockCount} stock bajo
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* ── Panel: Importar desde Google Sheets ─────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Download size={18} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-800 leading-tight">
                Importar desde Google Sheets
              </p>
              <p className="text-xs text-blue-600 mt-0.5 leading-snug">
                Agrega o edita filas en la hoja <span className="font-semibold">INVENTARIO</span> y
                pulsa <span className="font-semibold">Actualizar</span> — todos los productos
                nuevos aparecerán en el POS al instante.
              </p>
              {lastSyncLabel ? (
                <p className="flex items-center gap-1 text-xs text-blue-400 mt-1.5">
                  <Clock size={11} />
                  Última actualización {lastSyncLabel}
                </p>
              ) : (
                <p className="text-xs text-blue-400 mt-1.5">Sin sincronización registrada</p>
              )}
            </div>
          </div>

          <button
            onClick={handleSync}
            disabled={!state.isOnline || state.syncStatus === 'syncing'}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5
                       bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                       text-white rounded-xl text-sm font-semibold
                       transition-colors shadow-sm"
          >
            <RefreshCw
              size={14}
              className={state.syncStatus === 'syncing' ? 'animate-spin' : ''}
            />
            {state.syncStatus === 'syncing' ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Buscador — SearchInput gestiona su propio valor internamente */}
      <SearchInput
        onSearch={handleSearch}
        onClose={() => handleSearch('')}
        placeholder="Buscar por descripción, código, clave o barcode…"
        inputClassName="bg-white border border-gray-200 shadow-sm"
      />

      {/* Tabla / estados */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
          <p className="text-sm">
            {searchQuery
              ? `Sin resultados para "${searchQuery}"`
              : 'No hay productos — sincroniza o agrega uno nuevo'}
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
          mode="inventory"
          onScan={(barcode) => handleInventoryScan(barcode)}
          onClose={() => setScanInventory(false)}
        />
      )}

    </div>
  );
}
