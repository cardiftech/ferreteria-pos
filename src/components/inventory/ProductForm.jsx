import { useState, useEffect } from 'react';
import { X, Save, Loader2, ScanLine, Plus, Minus } from 'lucide-react';
import BarcodeScanner from '../pos/BarcodeScanner';

// ── Definición de campos ──────────────────────────────────────────────────────
const FIELDS = [
  // Identificadores
  { key: 'Bar_code',                label: 'Código de Barras',     type: 'text',   required: true,  lockOnEdit: true, hasScanner: true },
  { key: 'Codigo',                  label: 'Código Interno',       type: 'text',   required: false },
  { key: 'Clave',                   label: 'Clave',                type: 'text',   required: false },
  // Información
  { key: 'Descripcion',             label: 'Descripción',          type: 'text',   required: true },
  { key: 'Marca',                   label: 'Marca',                type: 'text',   required: false },
  { key: 'Unidad',                  label: 'Unidad de Medida',     type: 'text',   required: false },
  { key: 'Codigo_SAT',              label: 'Código SAT',           type: 'text',   required: false },
  // Stock
  { key: 'Stock_Actual',            label: 'Stock Actual (Total)', type: 'number', required: true  },
  { key: 'Almacen_1',               label: 'Almacén 1',            type: 'number', required: false },
  { key: 'Almacen_2',               label: 'Almacén 2',            type: 'number', required: false },
  { key: 'Stock_Minimo',            label: 'Stock Mínimo',         type: 'number', required: true  },
  // Precios
  { key: 'Precio_publico_IVA',      label: 'Precio Público (IVA)',       type: 'number', required: true  },
  { key: 'Precio_medio_mayoreo_IVA',label: 'Precio Medio Mayoreo (IVA)', type: 'number', required: false },
  { key: 'Precio_mayoreo_IVA',      label: 'Precio Mayoreo (IVA)',       type: 'number', required: false },
  { key: 'Precio_distribuidor_IVA', label: 'Precio Distribuidor (IVA)',  type: 'number', required: false },
  // Imagen
  { key: 'Imagen',                  label: 'URL de Imagen',        type: 'url',    required: false },
];

const EMPTY = {
  Bar_code: '', Codigo: '', Clave: '', Descripcion: '', Marca: '', Unidad: '', Codigo_SAT: '',
  Stock_Actual: '', Almacen_1: '', Almacen_2: '', Stock_Minimo: '',
  Precio_publico_IVA: '', Precio_medio_mayoreo_IVA: '', Precio_mayoreo_IVA: '', Precio_distribuidor_IVA: '',
  Imagen: '',
};

// ── Modo Restock ──────────────────────────────────────────────────────────────
function RestockForm({ product, onSave, onCancel, loading }) {
  const [qty, setQty] = useState('1');
  const current  = Number(product.Stock_Actual);
  const qtyNum   = Math.max(0, parseInt(qty) || 0);
  const newStock = current + qtyNum;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (qtyNum <= 0) return;
    onSave({ ...product, Stock_Actual: newStock }, 'restock');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Restock de Producto</h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

          <div className="bg-orange-50 rounded-xl px-4 py-3 space-y-0.5">
            <p className="font-semibold text-gray-900 text-sm">{product.Descripcion}</p>
            <p className="text-xs text-gray-500 font-mono">{product.Bar_code}</p>
            {product.Marca && <p className="text-xs text-gray-400">{product.Marca}</p>}
            <p className="text-xs text-orange-600 font-medium mt-1">
              Stock actual: {current} unidades
              {(Number(product.Almacen_1) > 0 || Number(product.Almacen_2) > 0) && (
                <span className="ml-2 text-gray-400">
                  (A1: {Number(product.Almacen_1)} | A2: {Number(product.Almacen_2)})
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad a agregar</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty(String(Math.max(1, (parseInt(qty) || 1) - 1)))}
                className="w-11 h-11 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center
                           justify-center transition-colors flex-shrink-0"
              >
                <Minus size={18} />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onBlur={() => setQty(String(Math.max(1, parseInt(qty) || 1)))}
                className="flex-1 text-center text-2xl font-bold border border-gray-200
                           rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                type="button"
                onClick={() => setQty(String((parseInt(qty) || 0) + 1))}
                className="w-11 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white
                           flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center bg-green-50 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-600">Stock resultante</span>
            <span className="text-xl font-bold text-green-700">
              {current} + {qtyNum || '…'} = <span className="text-2xl">{qtyNum > 0 ? newStock : '—'}</span>
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} disabled={loading} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || qtyNum <= 0}
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
  const [form, setForm]        = useState(EMPTY);
  const [scanBarcode, setScan] = useState(false);
  const isEditing              = mode === 'edit';

  if (mode === 'restock' && product) {
    return <RestockForm product={product} onSave={onSave} onCancel={onCancel} loading={loading} />;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setForm(product ? { ...EMPTY, ...product } : EMPTY);
  }, [product]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      Stock_Actual:             Number(form.Stock_Actual),
      Almacen_1:                Number(form.Almacen_1) || 0,
      Almacen_2:                Number(form.Almacen_2) || 0,
      Stock_Minimo:             Number(form.Stock_Minimo),
      Precio_publico_IVA:       Number(form.Precio_publico_IVA)       || 0,
      Precio_medio_mayoreo_IVA: Number(form.Precio_medio_mayoreo_IVA) || 0,
      Precio_mayoreo_IVA:       Number(form.Precio_mayoreo_IVA)       || 0,
      Precio_distribuidor_IVA:  Number(form.Precio_distribuidor_IVA)  || 0,
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
                      value={form[key] ?? ''}
                      onChange={(e) => set(key, e.target.value)}
                      required={required}
                      disabled={isEditing && lockOnEdit}
                      step={type === 'number' ? 'any' : undefined}
                      min={type === 'number' ? 0 : undefined}
                      className="input-base disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    />
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

      {scanBarcode && (
        <div className="z-[60] relative">
          <BarcodeScanner
            onScan={(barcode) => { set('Bar_code', barcode); setScan(false); }}
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
