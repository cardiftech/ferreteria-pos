import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';

const FIELDS = [
  { key: 'Codigo_Barras', label: 'Código de Barras', type: 'text',   required: true,  lockOnEdit: true },
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

export default function ProductForm({ product, onSave, onCancel, loading }) {
  const [form, setForm] = useState(EMPTY);
  const isEditing = !!product;

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
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-4 space-y-3 overflow-y-auto">
            {FIELDS.map(({ key, label, type, required, lockOnEdit }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label}
                  {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
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
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
            <button type="button" onClick={onCancel} disabled={loading} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
