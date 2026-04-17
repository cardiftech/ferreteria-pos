import { NavLink } from 'react-router-dom';
import { ShoppingCart, Package } from 'lucide-react';

export default function BottomNav() {
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
        <Package size={22} />
        <span>Inventario</span>
      </NavLink>
    </nav>
  );
}
