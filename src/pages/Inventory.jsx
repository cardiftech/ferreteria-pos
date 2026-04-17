import { useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useInventory }  from '../hooks/useInventory';
import { useSearch }     from '../hooks/useSearch';
import { useApp }        from '../context/AppContext';
import { api }           from '../services/api';
import { updateLocalProduct } from '../services/sync';
import ProductTable      from '../components/inventory/ProductTable';
import ProductForm       from '../components/inventory/ProductForm';

export default function Inventory() {
  const [query, setQuery]         = useState('');
  const [editProduct, setEdit]    = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);

  const { products, loading, reload } = useInventory();
  const { notify, state, sync }       = useApp();
  const results = useSearch(products, query);

  const lowStockCount = products.filter(
    (p) => Number(p.Stock_Actual) <= Number(p.Stock_Minimo)
  ).length;

  const openEdit = (product) => { setEdit(product); setShowForm(true); };
  const openNew  = ()        => { setEdit(null);    setShowForm(true); };
  const closeForm = ()       => setShowForm(false);

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

      notify(
        editProduct ? 'Producto actualizado correctamente' : 'Producto agregado correctamente',
        'success'
      );
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
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {products.length} productos
            {lowStockCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">
                · {lowStockCount} con stock bajo
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={!state.isOnline}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} />
            Sincronizar
          </button>
          <button
            onClick={openNew}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={14} />
            Nuevo
          </button>
        </div>
      </div>

      {/* Buscador de tabla */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar productos…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        />
      </div>

      {/* Tabla / estados */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-sm">
            {query ? 'Sin resultados para ese filtro' : 'No hay productos — sincroniza o agrega uno nuevo'}
          </p>
        </div>
      ) : (
        <ProductTable products={results} onEdit={openEdit} />
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
