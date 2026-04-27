import { useState, useEffect } from 'react';
import { X, Save, Loader2, ScanLine, Plus, Minus, History } from 'lucide-react';
import BarcodeScanner from '../pos/BarcodeScanner';
import db from '../../services/db';

// Valida dígito verificador EAN-13.
// Retorna true=válido, false=inválido, null=no aplica (no son exactamente 13 dígitos)
function checkEAN13(code) {
  if (!/^\d{13}$/.test(String(code))) return null;
  const digits = String(code).split('').map(Number);
  const sum    = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check  = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

// ── Definición de campos ──────────────────────────────────────────────────────
const FIELDS = [
  // Identificadores
  { key: 'Bar_code',                label: 'Código de Barras',     type: 'text',   required: true,  lockOnEdit: true, hasScanner: true },
  { key: 'Codigo',                  label: 'Código Interno',       type: 'text',   required: false },
  { key: 'Clave',                   label: 'Clave',                type: 'text',   required: false },
  // Información
  { key: 'Descripcion',             label: 'Descripción',          type: 'text',   required: true },
  { key: 'PROVEEDOR',               label: 'Proveedor',            type: 'text',   required: false },
  { key: 'Unidad',                  label: 'Unidad de Medida',     type: 'text',   required: false },
  { key: 'Codigo_SAT',              label: 'Código SAT',           type: 'text',   required: false },
  // Stock
  { key: 'Stock_Actual',            label: 'Stock Actual (Total)', type: 'number', required: true  },
  { key: 'Local',                   label: 'Local',                type: 'number', required: false },
  { key: 'Bodeguita',               label: 'Bodeguita',            type: 'number', required: false },
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
  Bar_code: '', Codigo: '', Clave: '', Descripcion: '', PROVEEDOR: '', Unidad: '', Codigo_SAT: '',
  Stock_Actual: '', Local: '', Bodeguita: '', Stock_Minimo: '',
  Precio_publico_IVA: '', Precio_medio_mayoreo_IVA: '', Precio_mayoreo_IVA: '', Precio_distribuidor_IVA: '',
  Imagen: '',
};

// ── Modo Restock ──────────────────────────────────────────────────────────────
function RestockForm({ product, onSave, onCancel, loading }) {
  const localStock    = Number(product.Local);
  const bodeguita     = Number(product.Bodeguita);

  // Almacén destino: elige el que ya tiene más stock como sugerencia
  const defaultWh     = localStock >= bodeguita ? 'Local' : 'Bodeguita';
  const [qty, setQty]         = useState('1');
  const [warehouse, setWh]    = useState(defaultWh);
  const [history, setHistory] = useState([]);

  const current    = Number(product.Stock_Actual);
  const qtyNum     = Math.max(0, parseInt(qty) || 0);
  const newTotal   = current + qtyNum;
  const newLocal   = warehouse === 'Local'     ? localStock + qtyNum : localStock;
  const newBodega  = warehouse === 'Bodeguita' ? bodeguita  + qtyNum : bodeguita;

  // Carga los últimos 3 eventos de restock de este producto desde IndexedDB
  useEffect(() => {
    db.restockHistory
      .where('Bar_code').equals(product.Bar_code)
      .reverse()
      .limit(3)
      .toArray()
      .then(setHistory)
      .catch(() => {});
  }, [product.Bar_code]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (qtyNum <= 0) return;
    onSave({
      ...product,
      Stock_Actual: newTotal,
      Local:        newLocal,
      Bodeguita:    newBodega,
    }, 'restock');
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

          {/* Producto */}
          <div className="bg-orange-50 rounded-xl px-4 py-3 space-y-0.5">
            <p className="font-semibold text-gray-900 text-sm">{product.Descripcion}</p>
            <p className="text-xs text-gray-500 font-mono">{product.Bar_code}</p>
            {product.PROVEEDOR && <p className="text-xs text-gray-400">{product.PROVEEDOR}</p>}
            <p className="text-xs text-orange-600 font-medium mt-1">
              Stock actual: {current} uds
              <span className="ml-2 text-gray-400">
                (Local: {localStock} | Bodeguita: {bodeguita})
              </span>
            </p>
          </div>

          {/* Selector de almacén destino */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿A qué almacén ingresan?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Local', 'Bodeguita'].map(wh => (
                <button
                  key={wh}
                  type="button"
                  onClick={() => setWh(wh)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors
                    ${warehouse === wh
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  {wh}
                  <span className="block text-xs font-normal mt-0.5 opacity-70">
                    {wh === 'Local' ? localStock : bodeguita} uds ahora
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad */}
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

          {/* Resumen resultante */}
          {qtyNum > 0 && (
            <div className="bg-green-50 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                Resultado del restock
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Stock total</span>
                <span className="font-bold text-green-700">{current} → {newTotal} uds</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {warehouse === 'Local' ? '📦 Local' : '🏪 Bodeguita'}
                </span>
                <span className="font-semibold text-green-700">
                  {warehouse === 'Local' ? localStock : bodeguita} → {warehouse === 'Local' ? newLocal : newBodega} uds
                </span>
              </div>
            </div>
          )}

          {/* Historial de restock reciente */}
          {history.length > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <History size={13} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Últimos restocks</span>
              </div>
              <div className="space-y-1.5">
                {history.map(h => (
                  <div key={h.id} className="flex justify-between text-xs text-gray-600">
                    <span className="text-gray-400">
                      {new Date(h.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                      {' '}
                      {new Date(h.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-medium text-green-700">+{h.delta} uds</span>
                    <span className="text-gray-400">{h.oldStock} → {h.newStock}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
  const [formError, setFormError] = useState('');
  const isEditing              = mode === 'edit';

  // ⚠ Este useEffect DEBE estar antes de cualquier return condicional para cumplir
  // las Reglas de Hooks (los hooks deben llamarse siempre en el mismo orden).
  // Cuando mode === 'restock' este efecto corre pero no produce ningún efecto visible
  // porque el componente devuelve <RestockForm> antes de usar `form`.
  useEffect(() => {
    if (mode === 'restock') return; // restock usa su propio estado interno
    setForm(product ? { ...EMPTY, ...product } : EMPTY);
  }, [product, mode]);

  if (mode === 'restock' && product) {
    return <RestockForm product={product} onSave={onSave} onCancel={onCancel} loading={loading} />;
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    // Validar que los precios no sean negativos
    const priceFields = [
      { key: 'Precio_publico_IVA',       label: 'Precio Público' },
      { key: 'Precio_medio_mayoreo_IVA', label: 'Precio Medio Mayoreo' },
      { key: 'Precio_mayoreo_IVA',       label: 'Precio Mayoreo' },
      { key: 'Precio_distribuidor_IVA',  label: 'Precio Distribuidor' },
    ];
    for (const { key, label } of priceFields) {
      const val = form[key];
      if (val !== '' && val !== undefined && Number(val) < 0) {
        setFormError(`${label} no puede ser negativo.`);
        return;
      }
    }
    if (form.Stock_Actual !== '' && Number(form.Stock_Actual) < 0) {
      setFormError('Stock Actual no puede ser negativo.');
      return;
    }
    if (form.Stock_Minimo !== '' && Number(form.Stock_Minimo) < 0) {
      setFormError('Stock Mínimo no puede ser negativo.');
      return;
    }

    onSave({
      ...form,
      Stock_Actual:             Number(form.Stock_Actual),
      Local:                    Number(form.Local)      || 0,
      Bodeguita:                Number(form.Bodeguita)  || 0,
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
                  {/* Advertencia de checksum EAN-13 — no bloqueante */}
                  {key === 'Bar_code' && checkEAN13(form.Bar_code) === false && (
                    <p className="text-xs text-orange-500 mt-1">
                      ⚠ Dígito verificador EAN-13 incorrecto — verifica el código
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t flex-shrink-0 space-y-3">
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ⚠ {formError}
                </p>
              )}
              <div className="flex gap-3">
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
