import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, CheckCircle2, AlertCircle, ShoppingCart } from 'lucide-react';

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
const COOLDOWN_MS    = 2000; // evita re-escanear el mismo código en 2 s

export default function BarcodeScanner({ onScan, onClose, cartCount = 0, cartTotal = 0, onCheckout }) {
  const scannerRef   = useRef(null);
  const lastScanned  = useRef({});           // { barcode: timestamp }
  const [feedback, setFeedback] = useState(null); // { text, ok }

  const showFeedback = useCallback((text, ok) => {
    setFeedback({ text, ok });
    setTimeout(() => setFeedback(null), 1800);
  }, []);

  const handleDecode = useCallback((decoded) => {
    const now  = Date.now();
    const last = lastScanned.current[decoded] || 0;
    if (now - last < COOLDOWN_MS) return;   // cooldown activo → ignora
    lastScanned.current[decoded] = now;
    onScan(decoded, showFeedback);          // POS decide si encontró el producto
  }, [onScan, showFeedback]);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_DIV_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 260, height: 110 },
          formatsToSupport: FORMATS,
          aspectRatio: 1.5,
        },
        handleDecode,
        undefined
      )
      .catch((err) => {
        console.error('Cámara no disponible:', err);
        onClose();
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm text-gray-800">Escáner continuo</p>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Cámara */}
        <div className="px-3 pt-3">
          <div id={SCANNER_DIV_ID} className="w-full rounded-xl overflow-hidden bg-gray-900" />
        </div>

        {/* Feedback del último scan */}
        <div className="h-10 flex items-center justify-center px-4">
          {feedback ? (
            <div className={`flex items-center gap-2 text-sm font-medium
              ${feedback.ok ? 'text-green-600' : 'text-red-500'}`}>
              {feedback.ok
                ? <CheckCircle2 size={16} />
                : <AlertCircle size={16} />}
              {feedback.text}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Apunta al código de barras — se agrega automáticamente
            </p>
          )}
        </div>

        {/* Resumen carrito + botón pagar */}
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between text-sm">
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
                ${cartTotal.toLocaleString('es-CO')}
              </span>
            )}
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
