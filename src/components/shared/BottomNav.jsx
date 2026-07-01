import { NavLink } from 'react-router-dom';
import { ShoppingCart, Package, Receipt } from 'lucide-react';
import { useLowStockCount } from '../../hooks/useLowStockCount';

export default function BottomNav() {
  const lowStock = useLowStockCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
      <NavLink
        to="/pos"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors
           ${isActive ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`
        }
      >
        <ShoppingCart size={22} />
        <span>Punto de Venta</span>
      </NavLink>

      <NavLink
        to="/inventory"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors
           ${isActive ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`
        }
      >
        {/* Ícono con badge de stock bajo */}
        <div className="relative">
          <Package size={22} />
          {lowStock > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5
                             bg-orange-500 text-white text-[10px] font-bold
                             rounded-full flex items-center justify-center leading-none">
              {lowStock > 99 ? '99+' : lowStock}
            </span>
          )}
        </div>
        <span>Inventario</span>
      </NavLink>

      <NavLink
        to="/sales"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors
           ${isActive ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`
        }
      >
        <Receipt size={22} />
        <span>Ventas</span>
      </NavLink>
    </nav>
  );
}
