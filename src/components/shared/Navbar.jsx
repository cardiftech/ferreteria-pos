import { NavLink } from 'react-router-dom';
import { ShoppingCart, Package, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSync } from '../../hooks/useSync';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Navbar() {
  const { state } = useApp();
  const { sync, syncStatus, lastSync } = useSync();

  const syncLabel = lastSync
    ? `Último sync: ${format(new Date(lastSync), 'HH:mm', { locale: es })}`
    : 'Sincronizar con Google Sheets';

  return (
    <header className="bg-blue-800 text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-lg font-bold tracking-tight">🔧 FerrePOS</span>
          </div>

          {/* Navegación central */}
          <nav className="flex items-center gap-1">
            <NavLink
              to="/pos"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
              }
            >
              <ShoppingCart size={16} />
              <span>Ventas</span>
            </NavLink>
            <NavLink
              to="/inventory"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`
              }
            >
              <Package size={16} />
              <span className="hidden sm:inline">Inventario</span>
              <span className="sm:hidden">Inv.</span>
            </NavLink>
          </nav>

          {/* Estado derecha */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => sync(true)}
              disabled={syncStatus === 'syncing' || !state.isOnline}
              title={syncLabel}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              <RefreshCw
                size={15}
                className={syncStatus === 'syncing' ? 'animate-spin' : ''}
              />
            </button>

            <div
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium
                ${state.isOnline ? 'bg-green-500/30' : 'bg-red-500/30'}`}
            >
              {state.isOnline
                ? <Wifi size={12} />
                : <WifiOff size={12} />}
              <span className="hidden sm:inline">
                {state.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
