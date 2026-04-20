import { CheckCircle2, Printer, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function buildReceiptHTML({ saleId, items, total, paymentMethod, cashReceived, change, customer, timestamp }) {
  const dateStr = format(new Date(timestamp), "dd/MM/yyyy HH:mm", { locale: es });

  const itemsRows = items.map((item) => {
    const subtotal = (Number(item.Precio_Venta) * item.quantity).toLocaleString('es-CO');
    const unitPrice = Number(item.Precio_Venta).toLocaleString('es-CO');
    return `
      <tr>
        <td class="item-name">${item.quantity}&times; ${item.Producto}</td>
        <td class="right bold">$${subtotal}</td>
      </tr>
      <tr>
        <td class="unit-price" colspan="2">$${unitPrice} c/u</td>
      </tr>`;
  }).join('');

  const changeRows = (paymentMethod === 'Efectivo' && cashReceived > 0) ? `
    <tr>
      <td>Recibido</td>
      <td class="right">$${Number(cashReceived).toLocaleString('es-CO')}</td>
    </tr>
    <tr>
      <td class="bold green">Cambio</td>
      <td class="right bold green">$${Number(change).toLocaleString('es-CO')}</td>
    </tr>` : '';

  const customerRow = customer
    ? `<tr><td>Cliente</td><td class="right">${customer}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Recibo ${saleId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #000;
      background: #fff;
      width: 72mm;
      margin: 0 auto;
      padding: 6mm 4mm;
    }

    .center   { text-align: center; }
    .right    { text-align: right; }
    .bold     { font-weight: bold; }
    .green    { color: #166534; }

    .store-name {
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 2px;
    }
    .store-sub {
      font-size: 10px;
      color: #555;
      margin-top: 2px;
    }

    hr {
      border: none;
      border-top: 1px dashed #aaa;
      margin: 8px 0;
    }
    hr.solid {
      border-top: 1px solid #000;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }
    td {
      padding: 2px 0;
      font-size: 12px;
    }
    .item-name {
      font-size: 12px;
      padding-right: 8px;
      word-break: break-word;
    }
    .unit-price {
      font-size: 10px;
      color: #666;
      padding-bottom: 5px;
    }

    .total-row td {
      font-size: 16px;
      font-weight: bold;
      padding-top: 6px;
    }
    .meta-label { color: #555; }

    .footer {
      text-align: center;
      margin-top: 14px;
      font-size: 11px;
      color: #555;
    }

    @page {
      size: 80mm auto;
      margin: 6mm 4mm;
    }
    @media print {
      body { padding: 0; margin: 0 auto; }
    }
  </style>
</head>
<body>

  <div class="center">
    <div class="store-name">FerrePOS</div>
    <div class="store-sub">Punto de Venta · Ferretería</div>
  </div>

  <hr>

  <table>
    <tr>
      <td class="meta-label">ID Venta</td>
      <td class="right" style="font-size:10px">${saleId}</td>
    </tr>
    <tr>
      <td class="meta-label">Fecha</td>
      <td class="right">${dateStr}</td>
    </tr>
    ${customerRow}
  </table>

  <hr>

  <table>
    ${itemsRows}
  </table>

  <hr class="solid">

  <table>
    <tr class="total-row">
      <td>TOTAL</td>
      <td class="right">$${Number(total).toLocaleString('es-CO')}</td>
    </tr>
    <tr>
      <td class="meta-label">Método de pago</td>
      <td class="right">${paymentMethod}</td>
    </tr>
    ${changeRows}
  </table>

  <div class="footer">
    <hr style="margin-bottom:10px">
    ¡Gracias por su compra!
  </div>

  <script>
    window.onload = function () {
      window.print();
      setTimeout(function () { window.close(); }, 800);
    };
  </script>
</body>
</html>`;
}

export default function Receipt({ sale, onClose }) {
  const {
    saleId, items, total, paymentMethod,
    cashReceived, change, customer, timestamp,
  } = sale;

  const handlePrint = () => {
    const html = buildReceiptHTML(sale);
    const win  = window.open('', '_blank', 'width=400,height=650,toolbar=0,menubar=0,scrollbars=1');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Cabecera verde */}
        <div className="bg-green-50 px-5 py-5 text-center border-b border-green-100">
          <CheckCircle2 size={44} className="mx-auto text-green-600 mb-2" />
          <h2 className="text-lg font-bold text-green-800">¡Venta Registrada!</h2>
          <p className="text-xs text-green-600 mt-0.5">El inventario fue actualizado</p>
        </div>

        {/* Cuerpo del recibo */}
        <div className="px-5 py-4 space-y-2 text-sm">

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
                <span>${Number(cashReceived).toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-green-700 font-semibold">
                <span>Cambio</span>
                <span>${Number(change).toLocaleString('es-CO')}</span>
              </div>
            </>
          )}
        </div>

        {/* Acciones */}
        <div className="px-5 py-4 border-t flex gap-3">
          <button
            onClick={handlePrint}
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
