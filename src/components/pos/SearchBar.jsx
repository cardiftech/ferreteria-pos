import { useState, useRef } from 'react';
import { Search, Camera, X } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';

export default function SearchBar({ value, onChange }) {
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);

  const handleScan = (barcode) => {
    onChange(barcode.trim());
    setScanning(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Buscar por nombre o código de barras…"
            autoComplete="off"
            className="w-full pl-10 pr-9 py-3 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          />
          {value && (
            <button
              onClick={() => { onChange(''); inputRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <button
          onClick={() => setScanning(true)}
          title="Escanear código de barras"
          className="p-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white
                     rounded-xl shadow-sm transition-colors flex-shrink-0"
        >
          <Camera size={20} />
        </button>
      </div>

      {scanning && (
        <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
      )}
    </>
  );
}
