import { Minus, Plus, Trash2 } from 'lucide-react';

export default function CartItem({ item, onUpdate, onRemove }) {
  const price = Number(item.Precio_Venta);
  const maxStock = Number(item.Stock_Actual);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">

      {/* Nombre + precio unitario */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.Producto}</p>
        <p className="text-xs text-gray-400">${price.toLocaleString('es-CO')} c/u</p>
      </div>

      {/* Controles cantidad */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => onUpdate(item.Codigo_Barras, item.quantity - 1)}
          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200
                     rounded-lg transition-colors text-gray-600"
        >
          <Minus size={12} />
        </button>
        <span className="w-6 text-center text-sm font-bold tabular-nums">
          {item.quantity}
        </span>
        <button
          onClick={() => onUpdate(item.Codigo_Barras, item.quantity + 1)}
          disabled={item.quantity >= maxStock}
          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200
                     rounded-lg transition-colors text-gray-600 disabled:opacity-30"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Subtotal + eliminar */}
      <div className="text-right flex-shrink-0 w-[4.5rem]">
        <p className="text-sm font-bold text-gray-900">
          ${(price * item.quantity).toLocaleString('es-CO')}
        </p>
        <button
          onClick={() => onRemove(item.Codigo_Barras)}
          className="mt-0.5 text-red-400 hover:text-red-600 transition-colors"
          aria-label="Eliminar"
        >
          <Trash2 size={12} />
        </button>
      </div>

    </div>
  );
}
