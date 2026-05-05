/**
 * PendingSalesModal — lista y gestiona las ventas que fallaron por red.
 *
 * Una venta queda en pendingSales (synced: 0) cuando:
 *   1. El request al GAS lanzó un error de red → la venta NO llegó al servidor.
 *   2. (Raro) El GAS procesó la venta pero la respuesta se perdió en el camino.
 *
 * Por eso se muestra advertencia antes de reintentar: en el caso 2,
 * reintentar crearía un duplicado en el historial. El cajero puede verificar
 * en el panel admin si la venta ya aparece y descartar en lugar de reintentar.
 */
import { useState, useEffect, useRef } from 'react';
import { liveQuery }   from 'dexie';
import { format }      from 'date-fns';
import { es }          from 'date-fns/locale';
import {
  X, RefreshCw, Trash2, AlertTriangle,
  CheckCircle2, Loader2, Info,
} from 'lucide-react';
import db                      from '../../services/db';
import { api }                 from '../../services/api';
import { decrementLocalStock } from '../../services/sync';

// ── Hook interno: live-query de ventas pendientes ────────────────────────────
function usePendingSales() {
  const [sales, setSales] = useState([]);

  useEffect(() => {
    const sub = liveQuery(() =>
      db.pendingSales.where('synced').equals(0).reverse().sortBy('timestamp')
    ).subscribe({
      next:  (data) => setSales(data),
      error: ()     => {},
    });
    return () => sub.unsubscribe();
  }, []);

  return sales;
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function PendingSalesModal({ onClose }) {
  const sales = usePendingSales();

  // Estado por venta: 'idle' | 'retrying' | 'success' | 'error' | 'discard-confirm'
  const [saleState,  setSaleState]  = useState({});
  const [saleError,  setSaleError]  = useState({});
  const retryingRef = useRef(new Set()); // evita llamadas duplicadas en retry-all

  const setS = (id, s) => setSaleState(prev => ({ ...prev, [id]: s }));
  const setE = (id, e) => setSaleError (prev => ({ ...prev, [id]: e }));

  // ── Reintentar una venta individual ────────────────────────────────────────
  const handleRetry = async (record) => {
    if (retryingRef.current.has(record.id)) return;
    retryingRef.current.add(record.id);
    setS(record.id, 'retrying');
    setE(record.id, '');
    try {
      const result = await api.registerSale({ sale: record.sale, items: record.items });
      if (result?.error) throw new Error(result.error);

      // Éxito: marcar como sincronizada.
      // Solo descontar stock si no se hizo ya al guardar offline (stockDecremented).
      await db.pendingSales.update(record.id, { synced: 1, saleId: result.saleId });
      if (!record.stockDecremented) {
        decrementLocalStock(record.items).catch(() => {});
      }
      // liveQuery la eliminará automáticamente de la lista tras el update
    } catch (err) {
      setS(record.id, 'error');
      setE(record.id, err.message || 'Error desconocido — revisa la conexión');
    } finally {
      retryingRef.current.delete(record.id);
    }
  };

  // ── Descartar una venta (requiere confirmación) ──────────────────────────
  const handleDiscard = async (id) => {
    await db.pendingSales.delete(id);
  };

  // ── Reintentar todas secuencialmente ─────────────────────────────────────
  // Secuencial (no paralelo) para respetar el lock de 15 s del GAS.
  const handleRetryAll = async () => {
    for (const record of sales) {
      await handleRetry(record);
    }
  };

  const allRetrying = sales.length > 0 && sales.every(r => retryingRef.current.has(r.id));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[88dvh]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-bold text-gray-900">Ventas sin registrar</h2>
            {sales.length > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {sales.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── Banner informativo ───────────────────────────────────────────── */}
        {sales.length > 0 && (
          <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-100 flex gap-2">
            <Info size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 leading-snug">
              Se guardaron localmente por un corte de red.{' '}
              <strong>Reintenta</strong> para registrarlas en el servidor.{' '}
              <strong>Descarta</strong> solo si ya verificaste que aparecen en el historial.
            </p>
          </div>
        )}

        {/* ── Lista ──────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle2 size={44} className="text-green-400" />
              <p className="text-sm font-medium text-gray-600">Todas las ventas están registradas</p>
              <p className="text-xs text-gray-400">No hay ventas pendientes</p>
            </div>
          ) : (
            sales.map(record => {
              const st         = saleState[record.id] || 'idle';
              const isRetrying = st === 'retrying';
              const hasError   = st === 'error';
              const confirming = st === 'discard-confirm';
              const items      = record.items || [];

              return (
                <div key={record.id} className="px-5 py-4 border-b last:border-b-0">

                  {/* Fecha + total */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">
                        {format(new Date(record.timestamp), "EEEE dd/MM/yyyy · HH:mm", { locale: es })}
                      </p>
                      {record.sale?.customer && (
                        <p className="text-xs text-gray-500 mt-0.5">{record.sale.customer}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">
                        ${Number(record.sale?.total || 0).toLocaleString('es-MX')}
                      </p>
                      <p className="text-xs text-gray-400">{record.sale?.paymentMethod}</p>
                    </div>
                  </div>

                  {/* Productos */}
                  <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 space-y-1">
                    {items.map((item, i) => (
                      <div key={i} className="flex justify-between gap-2 text-xs">
                        <span className="text-gray-700 truncate">
                          <span className="font-medium text-gray-900">{item.quantity}×</span>{' '}
                          {item.Descripcion}
                        </span>
                        <span className="text-gray-500 flex-shrink-0">
                          ${Number(item.activePrice).toLocaleString('es-MX')} c/u
                        </span>
                      </div>
                    ))}
                    {record.sale?.notas && (
                      <p className="text-xs text-gray-400 italic pt-0.5">{record.sale.notas}</p>
                    )}
                  </div>

                  {/* Error */}
                  {hasError && saleError[record.id] && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100
                                    rounded-xl px-3 py-2 mb-3">
                      <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{saleError[record.id]}</p>
                    </div>
                  )}

                  {/* Botones de acción */}
                  <div className="flex gap-2">
                    {/* Reintentar */}
                    <button
                      onClick={() => handleRetry(record)}
                      disabled={isRetrying}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                                 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold
                                 transition-colors disabled:opacity-60"
                    >
                      {isRetrying
                        ? <><Loader2 size={13} className="animate-spin" /> Registrando…</>
                        : <><RefreshCw size={13} /> Reintentar</>}
                    </button>

                    {/* Descartar — con confirmación en dos pasos */}
                    {confirming ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleDiscard(record.id)}
                          className="px-3 py-2.5 rounded-xl bg-red-500 hover:bg-red-600
                                     text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          Sí, descartar
                        </button>
                        <button
                          onClick={() => setS(record.id, 'idle')}
                          className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200
                                     text-gray-600 text-xs font-medium transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setS(record.id, 'discard-confirm')}
                        disabled={isRetrying}
                        title="Eliminar esta venta pendiente sin registrarla"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl
                                   bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-400
                                   text-xs font-medium transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                        Descartar
                      </button>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* ── Footer: reintentar todas ─────────────────────────────────── */}
        {sales.length > 1 && (
          <div className="px-5 py-3 border-t flex-shrink-0">
            <button
              onClick={handleRetryAll}
              disabled={allRetrying}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                         bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm
                         transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={allRetrying ? 'animate-spin' : ''} />
              Reintentar todas ({sales.length})
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
