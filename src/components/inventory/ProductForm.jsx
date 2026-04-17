import { useState, useEffect } from 'react';
import { X, Save, Loader2, ScanLine, Plus, Minus } from 'lucide-react';
import BarcodeScanner from '../pos/BarcodeScanner';

const FIELDS = [
  { key: 'Codigo_Barras', label: 'Código de Barras', type: 'text',   required: true,  lockOnEdit: true, hasScanner: true },
  { key: 'Producto',      label: 'Nombre Producto',  type: 'text',   required: true },
  { key: 'Categoria',     label: 'Categoría',        type: 'text',   required: true },
  { key: 'Stock_Actual',  label: 'Stock Actual',     type: 'number', required: true },
  { key: 'Stock_Minimo',  label: 'Stock Mínimo',     type: 'number', required: true },
  { key: 'Precio_Venta',  label: 'Precio de Venta',  type: 'number', required: true },
  { key: 'Imagen',        label: 'URL de Imagen',    type: 'url',    required: false },
];

const EMPTY = {
  Codigo_Barras: '', Producto: '', Categoria: '',
  Stock_Actual: '', Stock_Minimo: '', Precio_Venta: '', Imagen: '',
};

// ── Modo Restock ──────────────────────────────────────────────────────────────
function RestockForm({ product, onSave, onCancel, loading }) {
  const [qty, setQty] = useState(1);
  const current  = Number(product.Stock_Actual);
  const newStock = current + qty;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (qty <= 0) return;
    onSave({ ...product, Stock_Actual: newStock }, 'restock');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Restock de Producto</h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

          {/* Info del producto */}
          <div className="bg-orange-50 rounded-xl px-4 py-3 space-y-0.5">
            <p className="font-semibold text-gray-900 text-sm">{product.Producto}</p>
            <p className="text-xs text-gray-500 font-mono">{product.Codigo_Barras}</p>
            <p className="text-xs text-orange-600 font-medium mt-1">
              Stock actual: {current} unidades
            </p>
          </div>

          {/* Cantidad a agregar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cantidad a agregar
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center
                           justify-center transition-colors flex-shrink-0"
              >
                <Minus size={18} />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 text-center text-2xl font-bold border border-gray-200
                           rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="w-11 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white
                           flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Preview stock resultante */}
          <div className="flex justify-between items-center bg-green-50 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-600">Stock resultante</span>
            <span className="text-xl font-bold text-green-700">
              {current} + {qty} = <span className="text-2xl">{newStock}</span>
            </span>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} disabled={loading} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || qty <= 0}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2.5
                         rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {loading ? 'Guardando…' : 'Confirmar Restock'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

// ── Modo Nuevo / Editar ───────────────────────────────────────────────────────
export default function ProductForm({ product, mode = 'new', onSave, onCancel, loading }) {
  const [form, setForm]         = useState(EMPTY);
  const [scanBarcode, setScan]  = useState(false);
  const isEditing               = mode === 'edit';

  // Modo restock → delegar al componente dedicado
  if (mode === 'restock' && product) {
    return <RestockForm product={product} onSave={onSave} onCancel={onCancel} loading={loading} />;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setForm(product ? { ...EMPTY, ...product } : EMPTY);
  }, [product]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      Stock_Actual: Number(form.Stock_Actual),
      Stock_Minimo: Number(form.Stock_Minimo),
      Precio_Venta: Number(form.Precio_Venta),
    }, mode);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">

          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900">
              {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              {FIELDS.map(({ key, label, type, required, lockOnEdit, hasScanner }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={type}
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      required={required}
                      disabled={isEditing && lockOnEdit}
                      step={type === 'number' ? 'any' : undefined}
                      min={type === 'number' ? 0 : undefined}
                      className="input-base disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
                    {/* Botón escáner solo en campo Codigo_Barras de nuevo producto */}
                    {hasScanner && !isEditing && (
                      <button
                        type="button"
                        onClick={() => setScan(true)}
                        title="Escanear código"
                        className="flex-shrink-0 px-3 bg-orange-500 hover:bg-orange-600 text-white
                                   rounded-lg transition-colors"
                      >
                        <ScanLine size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
              <button type="button" onClick={onCancel} disabled={loading} className="flex-1 btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2
                           rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {loading ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Escáner para llenar el código de barras */}
      {scanBarcode && (
        <div className="z-[60] relative">
          <BarcodeScanner
            onScan={(barcode) => {
              set('Codigo_Barras', barcode);
              setScan(false);
            }}
            onClose={() => setScan(false)}
            cartCount={0}
            cartTotal={0}
            onCheckout={() => setScan(false)}
          />
        </div>
      )}
    </>
  );
}
