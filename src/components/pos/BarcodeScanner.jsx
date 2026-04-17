import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, ScanLine } from 'lucide-react';

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

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const scannedRef = useRef(false); // evita disparar onScan dos veces

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
        (decoded) => {
          if (!scannedRef.current) {
            scannedRef.current = true;
            // Pequeño delay para que el usuario vea el frame congelado
            setTimeout(() => onScan(decoded), 200);
          }
        },
        undefined // error silenciosa durante el scan continuo
      )
      .catch((err) => {
        console.error('No se pudo iniciar la cámara:', err);
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
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">

        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 text-gray-800">
            <ScanLine size={18} className="text-blue-600" />
            <h3 className="font-semibold text-sm">Escanear código de barras</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-3">
          <div
            id={SCANNER_DIV_ID}
            className="w-full rounded-lg overflow-hidden bg-gray-900"
          />
          <p className="text-center text-xs text-gray-500 mt-3 pb-1">
            Apunta la cámara al código • EAN-13, Code128, QR y más
          </p>
        </div>

      </div>
    </div>
  );
}
