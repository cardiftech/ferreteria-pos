/**
 * InventoryCoverageCard — aviso de cobertura de inventario.
 *
 * Muestra cuántos productos NO tienen existencias (Stock_Actual <= 0) y qué
 * porcentaje del catálogo ya tiene stock cargado. Sirve como recordatorio
 * visible para que el equipo termine de cargar las existencias: mientras haya
 * productos en 0, no se pueden vender desde el POS y el sistema no opera al 100 %.
 *
 * Es puramente presentacional — recibe los números ya calculados y notifica
 * al padre cuando el usuario quiere ver solo los productos sin stock.
 */
import { Package, PackageCheck, AlertTriangle, ArrowRight } from 'lucide-react';

export default function InventoryCoverageCard({
  total,
  withoutStock,
  filterActive = false,
  onToggleFilter,
}) {
  // Sin catálogo aún → el panel de importación ya guía al usuario; no estorbamos.
  if (!total || total <= 0) return null;

  const withStock = Math.max(0, total - withoutStock);
  const pct       = Math.round((withStock / total) * 100);
  const complete  = withoutStock <= 0;

  // ── Estado completo: tarjeta verde compacta ──────────────────────────────
  if (complete) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <PackageCheck size={18} className="text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-green-800 leading-tight">
              Inventario completo
            </p>
            <p className="text-xs text-green-600 mt-0.5 leading-snug">
              Los {total.toLocaleString('es-MX')} productos tienen existencias registradas.
              El sistema opera al 100 %.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Estado incompleto: tarjeta ámbar con progreso y acción ───────────────
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <Package size={18} className="text-amber-600" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Título + porcentaje */}
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-amber-900 leading-tight">
              Cobertura de inventario
            </p>
            <span className="text-sm font-bold text-amber-700 flex-shrink-0 tabular-nums">
              {pct}%
            </span>
          </div>

          <p className="text-xs text-amber-700 mt-0.5">
            {withStock.toLocaleString('es-MX')} de {total.toLocaleString('es-MX')} productos con stock
          </p>

          {/* Barra de progreso */}
          <div className="h-2 bg-amber-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Mensaje motivacional */}
          <div className="flex items-start gap-1.5 mt-2.5">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-snug">
              <span className="font-semibold">
                {withoutStock.toLocaleString('es-MX')}{' '}
                {withoutStock === 1 ? 'producto sin existencias' : 'productos sin existencias'}
              </span>{' '}
              — no se pueden vender hasta cargar su stock. Complétalos para aprovechar
              el sistema al máximo.
            </p>
          </div>

          {/* Acción: filtrar a productos sin stock */}
          {onToggleFilter && (
            <button
              onClick={onToggleFilter}
              className={`mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs
                          font-semibold transition-colors shadow-sm
                          ${filterActive
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-100'}`}
            >
              {filterActive ? (
                <>Mostrando solo sin stock · Ver todos</>
              ) : (
                <>
                  Ver productos sin stock
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
