/**
 * InventoryCoverageBanner — aviso PROMINENTE (rojo) en el POS que señala el
 * porcentaje del inventario ya cargado y cuántos productos siguen sin existencias.
 *
 * Objetivo: motivar a completar la carga de stock. Mientras haya productos sin
 * existencias el sistema no puede vender con todo su potencial.
 *
 * Comportamiento:
 *   • NO desaparece solo — se cierra con un clic (obliga a leerlo conscientemente).
 *   • Se muestra UNA vez por sesión (sessionStorage): tras cerrarlo no vuelve a
 *     estorbar hasta el siguiente arranque de la app. No nag en cada venta.
 *   • Desaparece por completo cuando el inventario llega al 100 % (withoutStock 0).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { useStockCoverage } from '../../hooks/useStockCoverage';

const DISMISS_KEY = 'ferrepos:coverageBannerDismissed';

export default function InventoryCoverageBanner() {
  const { total, withoutStock, pct } = useStockCoverage();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1'
  );

  // No mostrar si: ya se cerró esta sesión · el inventario aún no carga (pct null)
  // · ya todo tiene existencias (nada que avisar).
  if (dismissed || pct === null || withoutStock === 0) return null;

  const close = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const goToInventory = () => {
    close();
    navigate('/inventory');
  };

  return (
    <div className="px-3 pt-3">
      <div className="relative rounded-2xl bg-gradient-to-br from-red-500 to-red-600
                      text-white shadow-lg overflow-hidden">

        {/* Cerrar — clic obligatorio para descartarlo */}
        <button
          onClick={close}
          aria-label="Cerrar aviso"
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/15
                     hover:bg-white/25 flex items-center justify-center transition-colors"
        >
          <X size={15} />
        </button>

        <div className="p-4">
          {/* Encabezado */}
          <div className="flex items-center gap-2 mb-3 pr-8">
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center
                             flex-shrink-0 animate-pulse">
              <AlertTriangle size={14} />
            </span>
            <h3 className="font-bold text-sm">Inventario incompleto</h3>
          </div>

          {/* Porcentaje grande — el dato protagonista */}
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-4xl font-extrabold tracking-tight leading-none">{pct}%</span>
            <span className="text-sm font-medium text-white/80">del inventario cargado</span>
          </div>

          {/* Barra de progreso */}
          <div className="h-1.5 rounded-full bg-white/25 overflow-hidden mb-3">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Detalle */}
          <p className="text-xs text-white/90 leading-snug mb-3.5">
            <span className="font-semibold">{withoutStock.toLocaleString('es-MX')}</span> de{' '}
            <span className="font-semibold">{total.toLocaleString('es-MX')}</span> productos
            aún no tienen existencias. Complétalos para que el sistema venda con todo su potencial.
          </p>

          {/* Acción — lleva a la pestaña de inventario */}
          <button
            onClick={goToInventory}
            className="w-full py-2.5 rounded-xl bg-white text-red-600 font-bold text-sm
                       flex items-center justify-center gap-1.5 hover:bg-red-50
                       active:scale-[0.98] transition-all"
          >
            Completar inventario
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
