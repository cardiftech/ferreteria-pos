import { AlertTriangle, Edit2, Package } from 'lucide-react';

export default function ProductTable({ products, onEdit }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap text-xs uppercase tracking-wide">
                Bar code
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                Descripción
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">
                Marca
              </th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                Stock
              </th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">
                A1 / A2
              </th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                P. Público
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => {
              const stock    = Number(p.Stock_Actual);
              const minStock = Number(p.Stock_Minimo);
              const price    = Number(p.Precio_publico_IVA);
              const a1       = Number(p.Almacen_1);
              const a2       = Number(p.Almacen_2);
              const out      = stock <= 0;
              const low      = !out && stock <= minStock;

              return (
                <tr
                  key={p.Bar_code}
                  className={[
                    'hover:bg-gray-50 transition-colors',
                    out ? 'bg-red-50 hover:bg-red-50'       : '',
                    low ? 'bg-orange-50 hover:bg-orange-50' : '',
                  ].join(' ')}
                >
                  {/* Bar code */}
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                    {p.Bar_code}
                  </td>

                  {/* Descripción */}
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
                      <div>
                        <p className="font-medium text-gray-900 leading-snug">{p.Descripcion}</p>
                        {p.Clave && (
                          <p className="text-xs text-gray-400">{p.Clave}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Marca */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.Marca && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {p.Marca}
                      </span>
                    )}
                  </td>

                  {/* Stock total */}
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

                  {/* Almacenes */}
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="text-xs text-gray-500">
                      <span className="text-blue-600 font-medium">{a1}</span>
                      <span className="text-gray-300 mx-1">/</span>
                      <span className="text-indigo-600 font-medium">{a2}</span>
                    </span>
                  </td>

                  {/* Precio público */}
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                    ${price.toLocaleString('es-MX')}
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
