/**
 * SaleEditModal — edita los campos básicos de una venta de la hoja VENTAS.
 *
 * Editable: Total, Método de pago, Cliente, Notas.
 * NO editable: Productos (cambiarlos no re-ajustaría el stock) ni ID/Fecha.
 * Permite eliminar el registro (con doble confirmación) — no restaura stock.
 *
 * Requiere conexión: las ventas viven en Google Sheets, no en la BD local.
 */
import { useState } from 'react';
import {
  X, Trash2, Save, Loader2, AlertTriangle, WifiOff, Package,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '../../services/api';

const PAYMENT_METHODS = [
  { id: 'Efectivo',      emoji: '💵' },
  { id: 'Tarjeta',       emoji: '💳' },
  { id: 'Transferencia', emoji: '🏦' },
];

function safeDate(iso) {
  if (!iso) return '';
  try { return format(new Date(iso), "EEEE dd/MM/yyyy · HH:mm", { locale: es }); }
  catch { return String(iso); }
}

export default function SaleEditModal({ sale, onClose, onSaved, onDeleted, notify, isOnline = true, canEdit = true }) {
  const [total,      setTotal]      = useState(String(sale.Total ?? ''));
  const [metodo,     setMetodo]     = useState(sale.Metodo_Pago || 'Efectivo');
  const [cliente,    setCliente]    = useState(sale.Cliente || '');
  const [notas,      setNotas]      = useState(sale.Notas || '');
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const editable = canEdit && isOnline;   // requiere conexión Y endpoints desplegados

  const dirty =
    String(sale.Total ?? '') !== total.trim() ||
    (sale.Metodo_Pago || 'Efectivo') !== metodo ||
    (sale.Cliente || '') !== cliente.trim() ||
    (sale.Notas || '')    !== notas.trim();

  const handleSave = async () => {
    if (!editable) { notify?.('No se puede editar en este momento', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ID_Venta:    sale.ID_Venta,
        Total:       Number(total) || 0,
        Metodo_Pago: metodo,
        Cliente:     cliente.trim(),
        Notas:       notas.trim(),
      };
      const res = await api.updateSale(payload);
      if (res?.error) throw new Error(res.error);
      notify?.('Venta actualizada', 'success');
      onSaved?.({ ...sale, ...payload });
    } catch (err) {
      notify?.(err.message || 'Error al actualizar la venta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editable) { notify?.('No se puede eliminar en este momento', 'error'); return; }
    setDeleting(true);
    try {
      const res = await api.deleteSale({ ID_Venta: sale.ID_Venta });
      if (res?.error) throw new Error(res.error);
      notify?.('Venta eliminada', 'success');
      onDeleted?.(sale.ID_Venta);
    } catch (err) {
      notify?.(err.message || 'Error al eliminar la venta', 'error');
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[92dvh]">

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900">Editar venta</h2>
          <button onClick={onClose} disabled={busy}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Aviso sin conexión */}
          {!isOnline && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <WifiOff size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-snug">
                Sin conexión — necesitas internet para editar o eliminar ventas.
              </p>
            </div>
          )}

          {/* Aviso solo lectura — Code.gs sin endpoints de edición */}
          {isOnline && !canEdit && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-snug">
                Solo lectura — actualiza el <span className="font-mono">Code.gs</span> (redeploy) para
                editar o eliminar esta venta.
              </p>
            </div>
          )}

          {/* Datos no editables */}
          <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1">
            <div className="flex justify-between gap-2 text-xs">
              <span className="text-gray-400">ID</span>
              <span className="font-mono text-gray-600 truncate max-w-[70%] text-right">{sale.ID_Venta}</span>
            </div>
            {sale.Fecha && (
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-gray-400">Fecha</span>
                <span className="text-gray-600 capitalize">{safeDate(sale.Fecha)}</span>
              </div>
            )}
          </div>

          {/* Productos (solo lectura) */}
          {sale.Productos && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
                <Package size={12} /> Productos
              </p>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5 whitespace-pre-wrap
                              font-sans leading-relaxed max-h-32 overflow-y-auto">
                {String(sale.Productos)}
              </pre>
            </div>
          )}

          {/* Total */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Total</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={total}
                onChange={e => setTotal(e.target.value)}
                disabled={!editable}
                className="w-full pl-7 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-400
                           disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Método de pago</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(({ id, emoji }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMetodo(id)}
                  disabled={!editable}
                  className={`px-2 py-2.5 rounded-xl text-xs font-medium border transition-colors
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${metodo === id
                      ? 'bg-orange-50 border-orange-400 text-orange-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="mr-1">{emoji}</span>{id}
                </button>
              ))}
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cliente</label>
            <input
              type="text"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              disabled={!editable}
              placeholder="Sin cliente"
              className="w-full px-3 py-2.5 bg-gray-100 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-orange-400
                         disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              disabled={!editable}
              placeholder="Observaciones de la venta…"
              className="w-full px-3 py-2.5 bg-gray-100 rounded-xl text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-orange-400
                         disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Eliminar — doble confirmación */}
          <div className="pt-1">
            {confirmDel ? (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 leading-snug">
                    Se eliminará esta venta de la hoja. <strong>No restaura el stock</strong> descontado.
                    ¿Continuar?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                               bg-red-500 hover:bg-red-600 text-white text-xs font-semibold
                               transition-colors disabled:opacity-60"
                  >
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                  </button>
                  <button
                    onClick={() => setConfirmDel(false)}
                    disabled={busy}
                    className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600
                               text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDel(true)}
                disabled={busy || !editable}
                className="flex items-center gap-1.5 text-xs font-medium text-red-400
                           hover:text-red-600 transition-colors disabled:opacity-40"
              >
                <Trash2 size={13} /> Eliminar esta venta
              </button>
            )}
          </div>
        </div>

        {/* Footer: guardar */}
        <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600
                       font-semibold text-sm transition-colors disabled:opacity-60">
            Cerrar
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !dirty || !editable}
            className="flex-1 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600
                       disabled:bg-gray-200 disabled:text-gray-400
                       text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

      </div>
    </div>
  );
}
