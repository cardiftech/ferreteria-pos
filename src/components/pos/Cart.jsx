import { ShoppingCart, WifiOff } from 'lucide-react';
import CartItem from './CartItem';

export default function Cart({ items, total, onUpdate, onRemove, onCheckout, isOnline }) {
  if (items.length === 0) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-gray-300 min-h-[180px]">
        <ShoppingCart size={40} strokeWidth={1.2} />
        <p className="mt-2 text-sm text-gray-400 font-medium">Carrito vacío</p>
        <p className="text-xs text-gray-300 mt-0.5">Busca y agrega productos</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 text-sm">
          Carrito&nbsp;
          <span className="text-gray-400 font-normal">
            ({items.length} {items.length === 1 ? 'artículo' : 'artículos'})
          </span>
        </h3>
      </div>

      {/* Items — scrollable en móvil */}
      <div className="px-4 overflow-y-auto max-h-72 lg:max-h-96">
        {items.map((item) => (
          <CartItem
            key={item.Codigo_Barras}
            item={item}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </div>

      {/* Footer total + pago */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-sm">Total</span>
          <span className="text-2xl font-bold text-blue-700">
            ${total.toLocaleString('es-CO')}
          </span>
        </div>

        <button
          onClick={onCheckout}
          disabled={!isOnline}
          className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2"
        >
          {!isOnline && <WifiOff size={16} />}
          {isOnline ? 'Proceder al Pago' : 'Sin conexión'}
        </button>

        {!isOnline && (
          <p className="text-xs text-center text-orange-500">
            Reconecta a internet para finalizar la venta
          </p>
        )}
      </div>

    </div>
  );
}
