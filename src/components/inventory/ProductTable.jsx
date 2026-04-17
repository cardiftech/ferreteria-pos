import { AlertTriangle, Edit2, Package } from 'lucide-react';

export default function ProductTable({ products, onEdit }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap text-xs uppercase tracking-wide">
                Código
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                Producto
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">
                Categoría
              </th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                Stock
              </th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                Precio
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => {
              const stock    = Number(p.Stock_Actual);
              const minStock = Number(p.Stock_Minimo);
              const price    = Number(p.Precio_Venta);
              const out      = stock <= 0;
              const low      = !out && stock <= minStock;

              return (
                <tr
                  key={p.Codigo_Barras}
                  className={[
                    'hover:bg-gray-50 transition-colors',
                    out ? 'bg-red-50 hover:bg-red-50'    : '',
                    low ? 'bg-orange-50 hover:bg-orange-50' : '',
                  ].join(' ')}
                >
                  {/* Código */}
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                    {p.Codigo_Barras}
                  </td>

                  {/* Producto */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {p.Imagen ? (
                        <img
                          src={p.Imagen}
                          alt=""
                          className="w-8 h-8 object-cover rounded bg-gray-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">
                          <Package size={14} className="text-blue-300" />
                        </div>
                      )}
                      <span className="font-medium text-gray-900">{p.Producto}</span>
                    </div>
                  </td>

                  {/* Categoría */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                      {p.Categoria}
                    </span>
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={[
                        'inline-flex items-center gap-1 font-semibold',
                        out ? 'text-red-600' : low ? 'text-orange-600' : 'text-gray-700',
                      ].join(' ')}
                    >
                      {low && <AlertTriangle size={12} />}
                      {stock}
                      <span className="text-xs font-normal text-gray-400">/{minStock}</span>
                    </span>
                  </td>

                  {/* Precio */}
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                    ${price.toLocaleString('es-CO')}
                  </td>

                  {/* Editar */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onEdit(p)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700"
                      aria-label="Editar producto"
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
