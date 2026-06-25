import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePendingSalesCount } from '../../hooks/usePendingSalesCount';
import { useStockCoverage } from '../../hooks/useStockCoverage';
import PendingSalesModal from './PendingSalesModal';

export default function Navbar() {
  const { state, sync }  = useApp();
  const pendingCount     = usePendingSalesCount();
  const { pct: coveragePct } = useStockCoverage();
  const navigate         = useNavigate();
  const [showPending, setShowPending] = useState(false);
  const syncStatus       = state.syncStatus;
  const progress         = state.syncProgress;  // { loaded, total | null } | null
  const pct = progress
    ? (progress.total ? Math.round((progress.loaded / progress.total) * 100) : 5)
    : 0;

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">🔧</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-none text-sm">El Obraje</p>
              {progress ? (
                <p className="text-xs text-orange-500 leading-none mt-0.5 font-medium">
                  {progress.total
                    ? `Sincronizando… ${progress.loaded.toLocaleString()}/${progress.total.toLocaleString()}`
                    : 'Conectando con servidor…'}
                </p>
              ) : pendingCount > 0 ? (
                /* Alerta clickeable — abre el modal de ventas pendientes */
                <button
                  onClick={() => setShowPending(true)}
                  className="flex items-center gap-1 text-xs text-red-500 leading-none mt-0.5
                             font-semibold hover:text-red-700 transition-colors cursor-pointer"
                >
                  <AlertTriangle size={10} />
                  {pendingCount === 1
                    ? '1 venta sin registrar'
                    : `${pendingCount} ventas sin registrar`}
                </button>
              ) : coveragePct !== null && coveragePct < 100 ? (
                /* Recordatorio sutil de cobertura — clic lleva a Inventario a completar stock */
                <button
                  onClick={() => navigate('/inventory')}
                  title="Ver inventario — completa el stock de los productos faltantes"
                  className="text-xs text-gray-400 leading-none mt-0.5 hover:text-gray-600
                             transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-gray-500">{coveragePct}%</span> inventario cargado
                </button>
              ) : (
                <p className="text-xs text-gray-400 leading-none mt-0.5">Punto de Venta &amp; Inventario</p>
              )}
            </div>
          </div>

          {/* Estado sync + online */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => sync(true)}
              disabled={syncStatus === 'syncing' || !state.isOnline}
              title="Sincronizar inventario"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            </button>

            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium
              ${state.isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {state.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span>{state.isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* Barra de progreso de sync (solo visible cuando sincroniza) */}
        {progress && (
          <div className="h-0.5 bg-orange-100">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </header>

      {/* Modal de ventas pendientes */}
      {showPending && (
        <PendingSalesModal onClose={() => setShowPending(false)} />
      )}
    </>
  );
}
