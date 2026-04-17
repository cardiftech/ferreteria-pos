import { useState } from 'react';
import { X, CreditCard, Banknote, ArrowLeftRight, Loader2 } from 'lucide-react';

const METHODS = [
  { id: 'Efectivo',      label: 'Efectivo',      Icon: Banknote },
  { id: 'Tarjeta',       label: 'Tarjeta',        Icon: CreditCard },
  { id: 'Transferencia', label: 'Transferencia',  Icon: ArrowLeftRight },
];

export default function PaymentModal({ total, onConfirm, onCancel }) {
  const [method, setMethod]         = useState('Efectivo');
  const [cash, setCash]             = useState('');
  const [customer, setCustomer]     = useState('');
  const [notes, setNotes]           = useState('');
  const [loading, setLoading]       = useState(false);

  const cashNum  = parseFloat(cash) || 0;
  const change   = method === 'Efectivo' && cashNum > 0 ? Math.max(0, cashNum - total) : null;
  const canPay   = method !== 'Efectivo' || cashNum === 0 || cashNum >= total;

  const handleConfirm = async () => {
    if (!canPay) return;
    setLoading(true);
    try {
      await onConfirm({ method, cashReceived: cashNum, customer, notes });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Confirmar Pago</h2>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Total destacado */}
          <div className="flex justify-between items-center bg-blue-50 rounded-xl px-4 py-3">
            <span className="text-gray-600 font-medium text-sm">Total a cobrar</span>
            <span className="text-2xl font-bold text-blue-700">
              ${total.toLocaleString('es-CO')}
            </span>
          </div>

          {/* Método de pago */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Método de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id)}
                  className={[
                    'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all',
                    method === id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  ].join(' ')}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Efectivo recibido */}
          {method === 'Efectivo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Efectivo recibido
              </label>
              <input
                type="number"
                min={0}
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                placeholder={`Mínimo $${total.toLocaleString('es-CO')}`}
                className="input-base"
                autoFocus
              />
              {change !== null && (
                <p className={`mt-1.5 text-sm font-semibold ${change >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {change >= 0
                    ? `Cambio: $${change.toLocaleString('es-CO')}`
                    : `Faltan $${(total - cashNum).toLocaleString('es-CO')}`}
                </p>
              )}
            </div>
          )}

          {/* Cliente (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Nombre del cliente"
              className="input-base"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones de la venta…"
              className="input-base resize-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 btn-secondary">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !canPay}
            className="flex-1 btn-primary flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Procesando…' : 'Confirmar Venta'}
          </button>
        </div>

      </div>
    </div>
  );
}
