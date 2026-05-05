import { useState, useMemo } from 'react';
import { AlertTriangle, Edit2, Package, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// Cabecera de columna ordenable
function SortTh({ label, sortKey, current, dir, onSort, className = '' }) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide
                  cursor-pointer select-none hover:text-gray-900 transition-colors ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (dir === 'asc'
              ? <ChevronUp   size={12} className="text-orange-500" />
              : <ChevronDown size={12} className="text-orange-500" />)
          : <ChevronsUpDown size={12} className="text-gray-300" />}
      </span>
    </th>
  );
}

export default function ProductTable({ products, onEdit }) {
  const [sortKey, setSortKey] = useState(null);  // columna activa
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return products;
    return [...products].sort((a, b) => {
      if (sortKey === 'Stock_Actual' || sortKey === 'Precio_publico_IVA') {
        const diff = Number(a[sortKey]) - Number(b[sortKey]);
        return sortDir === 'asc' ? diff : -diff;
      }
      // Orden alfabético con locale español
      const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'es', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [products, sortKey, sortDir]);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap text-xs uppercase tracking-wide">
                Código
              </th>
              <SortTh label="Descripción"  sortKey="Descripcion"        current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left" />
              <SortTh label="Proveedor"    sortKey="PROVEEDOR"          current={sortKey} dir={sortDir} onSort={toggleSort} className="text-left hidden md:table-cell" />
              <SortTh label="Stock"        sortKey="Stock_Actual"       current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">
                Local / Bodeguita
              </th>
              <SortTh label="P. Público"   sortKey="Precio_publico_IVA" current={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((p) => {
              const stock    = Number(p.Stock_Actual);
              const minStock = Number(p.Stock_Minimo);
              const price    = Number(p.Precio_publico_IVA);
              const a1       = Number(p.Local);
              const a2       = Number(p.Bodeguita);
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
                  {/* Código (barcode real o código interno) */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-xs ${p._isFallbackKey ? 'text-blue-500' : 'text-gray-400'}`}>
                        {p.Bar_code}
                      </span>
                      {p._isFallbackKey && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-400
                                         border border-blue-100 px-1 py-0.5 rounded leading-none">
                          Cód. Int.
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Descripción */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {p.Imagen ? (
                        <img
                          src={p.Imagen}
                          alt=""
                          className="w-8 h-8 object-cover rounded bg-gray-100 flex-shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
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

                  {/* Proveedor */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.PROVEEDOR && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {p.PROVEEDOR}
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
