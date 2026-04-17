import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { useInventory }          from '../hooks/useInventory';
import { useSearch }             from '../hooks/useSearch';
import { useApp }                from '../context/AppContext';
import { api }                   from '../services/api';
import { updateLocalProduct }    from '../services/sync';
import ProductTable              from '../components/inventory/ProductTable';
import ProductForm               from '../components/inventory/ProductForm';

const PAGE_SIZE = 30;

export default function Inventory() {
  const [query, setQuery]       = useState('');
  const [editProduct, setEdit]  = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [visible, setVisible]   = useState(PAGE_SIZE);

  const { products, loading, reload } = useInventory();
  const { notify, state, sync }       = useApp();
  const results = useSearch(products, query);

  // Reiniciar paginación al cambiar búsqueda
  useEffect(() => setVisible(PAGE_SIZE), [query]);

  const shown        = results.slice(0, visible);
  const hasMore      = results.length > visible;
  const lowStockCount = products.filter(
    (p) => Number(p.Stock_Actual) <= Number(p.Stock_Minimo)
  ).length;

  const openEdit  = (p) => { setEdit(p);    setShowForm(true); };
  const openNew   = ()  => { setEdit(null); setShowForm(true); };
  const closeForm = ()  => setShowForm(false);

  const handleSave = async (data) => {
    if (!state.isOnline) {
      notify('Sin conexión — no se pueden guardar cambios', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = editProduct
        ? await api.updateProduct(data)
        : await api.addProduct(data);
      if (result?.error) throw new Error(result.error);
      await updateLocalProduct(data);
      await reload();
      notify(editProduct ? 'Producto actualizado' : 'Producto agregado', 'success');
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

          {/* Cargar más */}
          {hasMore && (
            <button
              onClick={() => setVisible((n) => n + PAGE_SIZE)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white
                         border border-gray-200 rounded-xl text-sm font-medium text-gray-600
                         hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ChevronDown size={16} />
              Cargar más ({results.length - visible} restantes)
            </button>
          )}

          <p className="text-center text-xs text-gray-400">
            Mostrando {shown.length} de {results.length} productos
          </p>
        </>
      )}

      {showForm && (
        <ProductForm
          product={editProduct}
          onSave={handleSave}
          onCancel={closeForm}
          loading={saving}
        />
      )}

    </div>
  );
}
