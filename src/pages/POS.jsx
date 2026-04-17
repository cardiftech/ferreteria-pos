import { useState, useRef } from 'react';
import { ScanLine, Search, X, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, ChevronDown } from 'lucide-react';
import { useInventory }  from '../hooks/useInventory';
import { useSearch }     from '../hooks/useSearch';
import { useCart }       from '../hooks/useCart';
import { useApp }        from '../context/AppContext';
import { api }           from '../services/api';
import BarcodeScanner    from '../components/pos/BarcodeScanner';
import PaymentModal      from '../components/pos/PaymentModal';
import Receipt           from '../components/pos/Receipt';

const PAYMENT_METHODS = [
  { id: 'Efectivo',      label: 'Efectivo',       emoji: '💵' },
  { id: 'Tarjeta',       label: 'Tarjeta',         emoji: '💳' },
  { id: 'Transferencia', label: 'Transferencia',   emoji: '🏦' },
];

// Altura del panel inferior fijo (total + método + botón)
const BOTTOM_PANEL_H = 'pb-[190px]';

export default function POS() {
  const [scanning, setScanning]     = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery]           = useState('');
  const [payMethod, setPayMethod]   = useState('Efectivo');
  const [showPay, setShowPay]       = useState(false);
  const [receipt, setReceipt]       = useState(null);
  const searchRef = useRef(null);

  const { products, reload }          = useInventory();
  const { notify, state, sync }       = useApp();
  const results                       = useSearch(products, query);
  const { cart, total, addItem, removeItem, updateQuantity, clearCart } = useCart();

  // ── Añadir producto (validando stock) ─────────────────────────────────────
  const handleAdd = (product) => {
    const inCart = cart.items.find((i) => i.Codigo_Barras === product.Codigo_Barras);
    if ((inCart?.quantity ?? 0) >= Number(product.Stock_Actual)) {
      notify(`Stock insuficiente (disponible: ${product.Stock_Actual})`, 'warning');
      return;
    }
    addItem(product);
    setQuery('');
    setSearchMode(false);
  };

  // ── Escáner: busca por código exacto ──────────────────────────────────────
  const handleScan = (barcode) => {
    setScanning(false);
    const found = products.find(
      (p) => String(p.Codigo_Barras).trim() === barcode.trim()
    );
    if (found) {
      handleAdd(found);
      notify(`✓ ${found.Producto} agregado`, 'success');
    } else {
      notify(`Código no encontrado: ${barcode}`, 'error');
    }
  };

  // ── Confirmar venta ────────────────────────────────────────────────────────
  const handleConfirmSale = async (payData) => {
    const result = await api.registerSale({
      sale: {
        total,
        paymentMethod: payData.method,
        customer:      payData.customer,
        notes:         payData.notes,
      },
      items: cart.items.map((i) => ({
        Codigo_Barras: i.Codigo_Barras,
        Producto:      i.Producto,
        quantity:      i.quantity,
        Precio_Venta:  i.Precio_Venta,
      })),
    });

    if (result?.error) throw new Error(result.error);

    const change = payData.method === 'Efectivo'
      ? Math.max(0, (payData.cashReceived || 0) - total)
      : 0;

    setReceipt({
      saleId:        result.saleId,
      items:         [...cart.items],
      total,
      paymentMethod: payData.method,
      cashReceived:  payData.cashReceived || 0,
      change,
      customer:      payData.customer,
      timestamp:     new Date().toISOString(),
    });

    clearCart();
    setShowPay(false);
    sync(true).then(reload).catch(() => {});
  };

  const currentMethod = PAYMENT_METHODS.find((m) => m.id === payMethod);
  const canFinalize   = cart.items.length > 0 && state.isOnline;

  return (
    <>
      {/* ── Área principal scrollable ──────────────────────────────────── */}
      <div className={`${BOTTOM_PANEL_H}`}>

        {/* Modo búsqueda por texto */}
        {searchMode ? (
          <div className="bg-white border-b border-gray-200 p-3 sticky top-0 z-30">
            <div className="relative flex items-center gap-2">
              <Search size={16} className="absolute left-3 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, código de barras…"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                onClick={() => { setSearchMode(false); setQuery(''); }}
                className="flex-shrink-0 p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Botones scanner + búsqueda */
          <div className="p-4 space-y-2">
            <button
              onClick={() => setScanning(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white
                         font-semibold py-4 rounded-2xl flex items-center justify-center gap-3
                         text-base shadow-sm transition-colors"
            >
              <ScanLine size={22} />
              Escanear Producto
            </button>
            <button
              onClick={() => { setSearchMode(true); setTimeout(() => searchRef.current?.focus(), 50); }}
              className="w-full bg-white hover:bg-gray-50 text-gray-600 font-medium py-3 rounded-2xl
                         flex items-center justify-center gap-2 text-sm border border-gray-200
                         shadow-sm transition-colors"
            >
              <Search size={16} className="text-gray-400" />
              Buscar por nombre o código
            </button>
          </div>
        )}

        {/* Resultados de búsqueda */}
        {searchMode && query.trim().length > 0 && (
          <div className="p-3 space-y-2">
            {results.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                Sin resultados para "{query}"
              </p>
            ) : (
              results.map((p) => {
                const stock = Number(p.Stock_Actual);
                const price = Number(p.Precio_Venta);
                const out   = stock <= 0;
                return (
                  <button
                    key={p.Codigo_Barras}
                    onClick={() => !out && handleAdd(p)}
                    disabled={out}
                    className={`w-full bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm
                                border border-gray-100 text-left transition-all active:scale-[0.98]
                                ${out ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                  >
                    <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-500 font-bold">{p.Producto?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{p.Producto}</p>
                      <p className="text-xs text-gray-400">{out ? 'Sin stock' : `Stock: ${stock}`}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="font-bold text-orange-600 text-sm">${price.toLocaleString('es-CO')}</p>
                      <div className="mt-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center ml-auto">
                        <Plus size={12} className="text-white" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Carrito de compras */}
        {!searchMode && (
          cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300 px-6 select-none">
              <ShoppingCart size={56} strokeWidth={1} />
              <p className="mt-3 text-sm font-medium text-gray-400">El carrito está vacío</p>
              <p className="text-xs text-gray-300 mt-1">Escanea un producto para comenzar</p>
            </div>
          ) : (
            <div className="px-4 pb-2 space-y-2">
              {cart.items.map((item) => {
                const price = Number(item.Precio_Venta);
                return (
                  <div key={item.Codigo_Barras}
                    className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100">
                    <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-500 font-bold text-sm">
                        {item.Producto?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.Producto}</p>
                      <p className="text-xs text-gray-400">${price.toLocaleString('es-CO')} c/u</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateQuantity(item.Codigo_Barras, item.quantity - 1)}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.Codigo_Barras, item.quantity + 1)}
                        disabled={item.quantity >= Number(item.Stock_Actual)}
                        className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white
                                   flex items-center justify-center transition-colors disabled:opacity-30">
                        <Plus size={12} />
                      </button>
                      <button onClick={() => removeItem(item.Codigo_Barras)}
                        className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-400
                                   flex items-center justify-center ml-1 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="w-16 text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        ${(price * item.quantity).toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ── Panel inferior fijo ────────────────────────────────────────── */}
      <div className="fixed bottom-14 left-0 right-0 z-30 bg-white border-t border-gray-200 px-4 py-3 space-y-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-sm font-medium">Total</span>
          <span className="text-2xl font-bold text-gray-900">
            ${total.toLocaleString('es-CO')}
          </span>
        </div>

        {/* Selector de método de pago */}
        <div className="relative">
          <select
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
            className="w-full appearance-none bg-gray-100 text-gray-700 font-medium
                       px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2
                       focus:ring-orange-400 cursor-pointer"
          >
            {PAYMENT_METHODS.map(({ id, label, emoji }) => (
              <option key={id} value={id}>{emoji} {label}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Botón finalizar */}
        <button
          onClick={() => setShowPay(true)}
          disabled={!canFinalize}
          className={`w-full py-3.5 rounded-2xl font-semibold text-base flex items-center
                      justify-center gap-2 transition-all
                      ${canFinalize
                        ? 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white shadow-sm'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        >
          <CheckCircle2 size={20} />
          {!state.isOnline ? 'Sin conexión' : cart.items.length === 0 ? 'Carrito vacío' : 'Finalizar Venta'}
        </button>
      </div>

      {/* ── Modales ────────────────────────────────────────────────────── */}
      {scanning && (
        <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
      )}

      {showPay && (
        <PaymentModal
          total={total}
          defaultMethod={payMethod}
          onConfirm={async (data) => {
            try {
              await handleConfirmSale(data);
            } catch (err) {
              notify(err.message || 'Error al registrar la venta', 'error');
              throw err;
            }
          }}
          onCancel={() => setShowPay(false)}
        />
      )}

      {receipt && (
        <Receipt sale={receipt} onClose={() => setReceipt(null)} />
      )}
    </>
  );
}
