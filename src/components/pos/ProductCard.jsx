import { Plus, AlertTriangle } from 'lucide-react';

export default function ProductCard({ product, onAdd }) {
  const stock = Number(product.Stock_Actual);
  const minStock = Number(product.Stock_Minimo);
  const price = Number(product.Precio_Venta);
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= minStock;
  const initial = product.Producto?.[0]?.toUpperCase() ?? '?';

  return (
    <div
      role="button"
      tabIndex={outOfStock ? -1 : 0}
      onClick={() => !outOfStock && onAdd(product)}
      onKeyDown={(e) => e.key === 'Enter' && !outOfStock && onAdd(product)}
      className={[
        'card p-3 flex items-center gap-3 cursor-pointer',
        'hover:shadow-md active:scale-[0.985] transition-all duration-100',
        outOfStock ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {/* Imagen / Avatar */}
      {product.Imagen ? (
        <img
          src={product.Imagen}
          alt={product.Producto}
          className="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-gray-100"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-blue-500 font-bold text-lg">{initial}</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">{product.Producto}</p>
        <p className="text-xs text-gray-400 font-mono">{product.Codigo_Barras}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {lowStock && <AlertTriangle size={11} className="text-orange-500 flex-shrink-0" />}
          <span className={`text-xs ${outOfStock ? 'text-red-600 font-semibold' : lowStock ? 'text-orange-600' : 'text-gray-400'}`}>
            {outOfStock ? 'Sin stock' : `Stock: ${stock}`}
          </span>
          <span className="text-xs text-gray-300 hidden sm:inline">
            · {product.Categoria}
          </span>
        </div>
      </div>

      {/* Precio + botón */}
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-blue-700 text-sm">
          ${price.toLocaleString('es-CO')}
        </p>
        <button
          disabled={outOfStock}
          tabIndex={-1}
          className="mt-1 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                     disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          aria-label={`Agregar ${product.Producto}`}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
