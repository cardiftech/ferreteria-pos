import { CheckCircle2, Printer, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Receipt({ sale, onClose }) {
  const {
    saleId, items, total, paymentMethod,
    cashReceived, change, customer, timestamp,
  } = sale;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Cabecera verde */}
        <div className="bg-green-50 px-5 py-5 text-center border-b border-green-100">
          <CheckCircle2 size={44} className="mx-auto text-green-600 mb-2" />
          <h2 className="text-lg font-bold text-green-800">¡Venta Registrada!</h2>
          <p className="text-xs text-green-600 mt-0.5">El inventario fue actualizado en Google Sheets</p>
        </div>

        {/* Cuerpo del recibo */}
        <div className="px-5 py-4 space-y-2 text-sm">

          {/* Meta */}
          <div className="flex justify-between text-gray-500">
            <span>ID Venta</span>
            <span className="font-mono text-xs text-gray-700">{saleId}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Fecha</span>
            <span className="text-gray-700">
              {format(new Date(timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
            </span>
          </div>
          {customer && (
            <div className="flex justify-between text-gray-500">
              <span>Cliente</span>
              <span className="text-gray-700">{customer}</span>
            </div>
          )}

          <hr className="border-dashed my-2" />

          {/* Productos */}
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.Codigo_Barras} className="flex justify-between gap-2">
                <span className="text-gray-700 truncate">
                  {item.quantity}× {item.Producto}
                </span>
                <span className="font-medium text-gray-900 flex-shrink-0">
                  ${(Number(item.Precio_Venta) * item.quantity).toLocaleString('es-CO')}
                </span>
              </div>
            ))}
          </div>

          <hr className="border-dashed my-2" />

          {/* Totales */}
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-blue-700">${total.toLocaleString('es-CO')}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Método</span>
            <span>{paymentMethod}</span>
          </div>
          {paymentMethod === 'Efectivo' && cashReceived > 0 && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>Recibido</span>
                <span>${cashReceived.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-green-700 font-semibold">
                <span>Cambio</span>
                <span>${change.toLocaleString('es-CO')}</span>
              </div>
            </>
          )}
        </div>

        {/* Acciones */}
        <div className="px-5 py-4 border-t flex gap-3 no-print">
          <button
            onClick={() => window.print()}
            className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
          >
            <Printer size={15} />
            Imprimir
          </button>
          <button
            onClick={onClose}
            className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
          >
            <RotateCcw size={15} />
            Nueva Venta
          </button>
        </div>

      </div>
    </div>
  );
}
