import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, CheckCircle2, AlertCircle, ShoppingCart, ScanLine, Minus, Plus, Trash2 } from 'lucide-react';
import { round2 } from '../../hooks/useCart';

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
];

const SCANNER_DIV_ID = 'barcode-reader-view';
const COOLDOWN_MS    = 2000;

export default function BarcodeScanner({
  onScan, onClose,
  cartCount = 0, cartTotal = 0, onCheckout,
  cartItems = [], onRemoveItem, onUpdateQuantity, onSetWarehouse,
  priceLevel,
  mode = 'pos',   // 'pos' | 'inventory' — en modo inventario se ocultan los controles del carrito
}) {
  const scannerRef    = useRef(null);
  const lastScanned   = useRef({});
  const viewRef       = useRef('scan');         // track view without re-render lag
  const lastScanTime  = useRef(Date.now());     // para detectar escáner inactivo
  const [view, setView]         = useState('scan');    // 'scan' | 'cart'
  const [feedback, setFeedback] = useState(null);
  const [scanIdle, setScanIdle] = useState(false);   // sin actividad 5+ seg

  const showFeedback = useCallback((text, ok) => {
    setFeedback({ text, ok });
    setTimeout(() => setFeedback(null), 1800);
  }, []);

  const handleDecode = useCallback((decoded) => {
    if (viewRef.current !== 'scan') return;   // ignore while viewing cart
    const now  = Date.now();
    const last = lastScanned.current[decoded] || 0;
    if (now - last < COOLDOWN_MS) return;
    lastScanned.current[decoded] = now;
    lastScanTime.current = now;               // reinicia el contador de inactividad
    setScanIdle(false);
    onScan(decoded, showFeedback);
  }, [onScan, showFeedback]);

  // Ref que siempre apunta al handleDecode más reciente.
  // El escáner Html5Qrcode se inicia una sola vez (sin re-inicializar la cámara
  // en cada render), por lo que el callback que recibe quedaría "congelado" con el
  // inventario del primer render. Este patrón — igual al de physicalScan.current
  // en POS — garantiza que el escáner de cámara siempre use el inventario actual,
  // incluso después de una sincronización con nuevos productos.
  const handleDecodeRef = useRef(handleDecode);
  useEffect(() => { handleDecodeRef.current = handleDecode; }, [handleDecode]);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_DIV_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 260, height: 110 }, formatsToSupport: FORMATS, aspectRatio: 1.5 },
        (decoded) => handleDecodeRef.current(decoded),  // wrapper estable → siempre llama al más reciente
        undefined
      )
      .catch((err) => { console.error('Cámara no disponible:', err); onClose(); });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detecta escáner sin actividad por 5+ segundos → muestra pista
  useEffect(() => {
    const id = setInterval(() => {
      if (viewRef.current !== 'scan') return;
      if (Date.now() - lastScanTime.current > 5000) setScanIdle(true);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const switchView = (v) => {
    viewRef.current = v;
    setView(v);
  };

  // ── Vista: Carrito editable ───────────────────────────────────────────────
  if (view === 'cart') {
    return (
      <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
        {/* Cámara sigue corriendo pero oculta para retomar rápido */}
        <div id={SCANNER_DIV_ID} className="hidden" />

        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
            <button
              onClick={() => switchView('scan')}
              className="flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600"
            >
              <ScanLine size={16} />
              Seguir escaneando
            </button>
            <span className="text-sm font-semibold text-gray-800">
              Carrito ({cartCount})
            </span>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={17} />
            </button>
          </div>

          {/* Lista de items */}
          <div className="overflow-y-auto flex-1">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <ShoppingCart size={44} strokeWidth={1} />
                <p className="mt-2 text-sm text-gray-400">El carrito está vacío</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {cartItems.map((item) => {
                  return (
                    <div key={item.Bar_code} className="flex items-start gap-3 px-4 py-3">
                      {/* Inicial */}
                      <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-orange-500 font-bold text-sm">
                          {item.Descripcion?.[0]?.toUpperCase()}
                        </span>
                      </div>

                      {/* Nombre + precio + almacén */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.Descripcion}</p>
                        <p className="text-xs text-gray-400">${item.activePrice.toLocaleString('es-MX')} c/u</p>
                        {onSetWarehouse && (
                          <div className="flex gap-1 mt-1">
                            {['Local', 'Bodeguita'].map(wh => {
                              const whStock  = Number(wh === 'Bodeguita' ? item.Bodeguita : item.Local);
                              const isActive = item.warehouse === wh;
                              const canUse   = isActive || whStock > 0;
                              return (
                                <button key={wh}
                                  onClick={() => canUse && onSetWarehouse(item.Bar_code, wh)}
                                  disabled={!canUse}
                                  title={`${wh}: ${whStock} uds`}
                                  className={`px-1.5 py-0.5 text-xs rounded font-medium transition-colors
                                    ${isActive
                                      ? 'bg-orange-500 text-white'
                                      : canUse
                                        ? 'bg-gray-100 text-gray-500'
                                        : 'bg-gray-50 text-gray-200 cursor-not-allowed line-through'}`}
                                >
                                  {wh} {whStock}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Cantidad */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => onUpdateQuantity?.(item.Bar_code, item.quantity - 1)}
                          className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity?.(item.Bar_code, item.quantity + 1)}
                          disabled={item.quantity >= Number(item.warehouse === 'Bodeguita' ? item.Bodeguita : item.Local)}
                          className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white
                                     flex items-center justify-center disabled:opacity-30"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      {/* Subtotal + eliminar */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900 w-16 text-right">
                          ${round2(item.activePrice * item.quantity).toLocaleString('es-MX')}
                        </span>
                        <button
                          onClick={() => onRemoveItem?.(item.Bar_code)}
                          className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-400
                                     flex items-center justify-center"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-2 flex-shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-xl font-bold text-gray-900">
                ${cartTotal.toLocaleString('es-MX')}
              </span>
            </div>
            <button
              onClick={onCheckout}
              disabled={cartCount === 0}
              className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center
                          justify-center gap-2 transition-colors
                          ${cartCount > 0
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              <CheckCircle2 size={17} />
              {cartCount > 0 ? 'Ir a Pagar' : 'Agrega productos primero'}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── Vista: Escáner ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm text-gray-800">
            {mode === 'inventory' ? 'Escanear producto' : 'Escáner continuo'}
          </p>
          <div className="flex items-center gap-2">
            {/* Botón carrito — solo en modo POS */}
            {mode === 'pos' && (
              <button
                onClick={() => switchView('cart')}
                className="relative p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Ver y editar carrito"
              >
                <ShoppingCart size={18} className="text-gray-600" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white
                                   text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Cámara */}
        <div className="px-3 pt-3">
          <div id={SCANNER_DIV_ID} className="w-full rounded-xl overflow-hidden bg-gray-900" />
        </div>

        {/* Feedback */}
        <div className="h-10 flex items-center justify-center px-4">
          {feedback ? (
            <div className={`flex items-center gap-2 text-sm font-medium
              ${feedback.ok ? 'text-green-600' : 'text-red-500'}`}>
              {feedback.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {feedback.text}
            </div>
          ) : scanIdle ? (
            <p className="text-xs text-orange-500 font-medium">
              Sin detección — limpia el lente o acerca más el código
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              Apunta al código de barras — se agrega automáticamente
            </p>
          )}
        </div>

        {/* Resumen carrito + botón pagar — solo en modo POS */}
        {mode === 'pos' && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2">
            <button
              onClick={() => switchView('cart')}
              className="w-full flex items-center justify-between text-sm px-3 py-2
                         bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-1.5 text-gray-500">
                <ShoppingCart size={15} />
                <span>
                  {cartCount === 0
                    ? 'Carrito vacío'
                    : `${cartCount} ${cartCount === 1 ? 'producto' : 'productos'}`}
                </span>
              </div>
              {cartTotal > 0 && (
                <span className="font-bold text-gray-900">
                  ${cartTotal.toLocaleString('es-MX')}
                </span>
              )}
            </button>

            <button
              onClick={onCheckout}
              disabled={cartCount === 0}
              className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center
                          justify-center gap-2 transition-colors
                          ${cartCount > 0
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              <CheckCircle2 size={17} />
              {cartCount > 0 ? 'Ir a Pagar' : 'Agrega productos primero'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
