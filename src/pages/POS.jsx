import { useState, useRef } from 'react';
import {
  ScanLine, Search, X, ShoppingCart, Plus, Minus, Trash2,
  CheckCircle2, ChevronDown, ChevronRight, User, Tag,
} from 'lucide-react';
import { useInventory }  from '../hooks/useInventory';
import { useSearch }     from '../hooks/useSearch';
import { useClients }    from '../hooks/useClients';
import { useDebounce }   from '../hooks/useDebounce';
import {
  useCart, PRICE_LEVELS, DEFAULT_PRICE_LEVEL,
  resolvePrice, autoWarehouse,
} from '../hooks/useCart';
import { useApp }        from '../context/AppContext';
import { api }           from '../services/api';
import BarcodeScanner    from '../components/pos/BarcodeScanner';
import PaymentModal      from '../components/pos/PaymentModal';
import Receipt           from '../components/pos/Receipt';

const PAYMENT_METHODS = [
  { id: 'Efectivo',      label: 'Efectivo',      emoji: '💵' },
  { id: 'Tarjeta',       label: 'Tarjeta',        emoji: '💳' },
  { id: 'Transferencia', label: 'Transferencia',  emoji: '🏦' },
];

const BOTTOM_PANEL_H = 'pb-[210px]';

// ── Helpers ───────────────────────────────────────────────────────────────────
function PriceLevelModal({ current, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Nivel de precio</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="py-2 pb-6">
          {Object.entries(PRICE_LEVELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { onSelect(key); onClose(); }}
              className={`w-full flex items-center justify-between px-5 py-3.5 text-left
                          hover:bg-gray-50 transition-colors
                          ${current === key ? 'text-orange-600' : 'text-gray-700'}`}
            >
              <span className="font-medium">{label}</span>
              {current === key && <CheckCircle2 size={18} className="text-orange-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientModal({ clients, selected, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const filtered = clients.filter(c =>
    c.Nombre.toLowerCase().includes(q.toLowerCase()) ||
    c.Telefono.includes(q)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[75dvh]">
        <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-bold text-gray-900">Seleccionar cliente</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-3 border-b flex-shrink-0">
          <input
            autoFocus
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="w-full px-3 py-2 bg-gray-100 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div className="overflow-y-auto flex-1 pb-6">
          {/* Opción "sin cliente" */}
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50
                        ${!selected ? 'text-orange-600' : 'text-gray-500'}`}
          >
            <User size={16} />
            <span className="text-sm">Sin cliente (precio público)</span>
            {!selected && <CheckCircle2 size={16} className="text-orange-500 ml-auto" />}
          </button>
          {filtered.length === 0 && q.trim() && (
            <p className="text-center text-sm text-gray-400 py-6">Sin resultados</p>
          )}
          {filtered.map(c => (
            <button
              key={c.ID_Cliente}
              onClick={() => { onSelect(c); onClose(); }}
              className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50
                          transition-colors
                          ${selected?.ID_Cliente === c.ID_Cliente ? 'text-orange-600' : 'text-gray-700'}`}
            >
              <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-orange-500 font-bold text-sm">
                  {c.Nombre?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.Nombre}</p>
                <p className="text-xs text-gray-400">{PRICE_LEVELS[c.Tipo_Precio] || c.Tipo_Precio}</p>
              </div>
              {selected?.ID_Cliente === c.ID_Cliente && (
                <CheckCircle2 size={16} className="text-orange-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── POS principal ─────────────────────────────────────────────────────────────
export default function POS() {
  const [scanning, setScanning]         = useState(false);
  const [searchMode, setSearchMode]     = useState(false);
  const [query, setQuery]               = useState('');
  const [payMethod, setPayMethod]       = useState('Efectivo');
  const [showPay, setShowPay]           = useState(false);
  const [receipt, setReceipt]           = useState(null);
  const [priceLevel, setPriceLevel]     = useState(DEFAULT_PRICE_LEVEL);
  const [selectedClient, setClient]     = useState(null);
  const [showPriceModal, setPriceModal] = useState(false);
  const [showClientModal, setClientModal] = useState(false);
  const searchRef = useRef(null);

  const { products, reload }             = useInventory();
  const { clients }                      = useClients();
  const { notify, state, sync }          = useApp();
  // Debounce 200ms → Fuse no corre en cada tecla
  const debouncedQuery                   = useDebounce(query, 200);
  const results                          = useSearch(products, debouncedQuery);
  const {
    cart, total, addItem, removeItem, updateQuantity, clearCart,
    changePriceLevel, setItemWarehouse,
  } = useCart();

  // ── Nivel de precio ─────────────────────────────────────────────────────────
  const handlePriceLevel = (level) => {
    setPriceLevel(level);
    changePriceLevel(level);
  };

  const handleClientSelect = (client) => {
    setClient(client);
    if (client?.Tipo_Precio) {
      handlePriceLevel(client.Tipo_Precio);
    } else {
      handlePriceLevel(DEFAULT_PRICE_LEVEL);
    }
  };

  // ── Agregar producto ────────────────────────────────────────────────────────
  const handleAdd = (product) => {
    const inCart = cart.items.find(i => i.Bar_code === product.Bar_code);
    if ((inCart?.quantity ?? 0) >= Number(product.Stock_Actual)) {
      notify(`Sin stock disponible (${product.Stock_Actual} uds)`, 'warning');
      return;
    }
    const wh = inCart?.warehouse || autoWarehouse(product);
    addItem(product, { priceLevel, warehouse: wh });
    setQuery('');
    setSearchMode(false);
  };

  // ── Escáner ─────────────────────────────────────────────────────────────────
  const handleScan = (barcode, showFeedback) => {
    const found = products.find(p => String(p.Bar_code).trim() === barcode.trim());
    if (found) {
      handleAdd(found);
      showFeedback?.(`✓ ${found.Descripcion}`, true);
    } else {
      showFeedback?.(`No encontrado: ${barcode}`, false);
    }
  };

  // ── Confirmar venta ─────────────────────────────────────────────────────────
  const handleConfirmSale = async (payData) => {
    const change = payData.method === 'Efectivo'
      ? Math.max(0, (payData.cashReceived || 0) - total)
      : 0;

    const result = await api.registerSale({
      sale: {
        total,
        paymentMethod: payData.method,
        customer:      payData.customer || selectedClient?.Nombre || '',
        pagos: JSON.stringify({
          cashReceived: payData.cashReceived || 0,
          change,
          notas: payData.notes || '',
        }),
      },
      items: cart.items.map(i => ({
        Bar_code:    i.Bar_code,
        Descripcion: i.Descripcion,
        quantity:    i.quantity,
        activePrice: i.activePrice,
        priceLevel:  i.priceLevel,
        warehouse:   i.warehouse,
      })),
    });

    if (result?.error) throw new Error(result.error);

    setReceipt({
      saleId:        result.saleId,
      items:         [...cart.items],
      total,
      paymentMethod: payData.method,
      cashReceived:  payData.cashReceived || 0,
      change,
      customer:      payData.customer || selectedClient?.Nombre || '',
      timestamp:     new Date().toISOString(),
    });

    clearCart();
    setShowPay(false);
    sync(true).then(reload).catch(() => {});
  };

  const currentMethod = PAYMENT_METHODS.find(m => m.id === payMethod);
  const canFinalize   = cart.items.length > 0 && state.isOnline;

  return (
    <>
      {/* ── Área principal ─────────────────────────────────────────────── */}
      <div className={BOTTOM_PANEL_H}>

        {/* Búsqueda por texto */}
        {searchMode ? (
          <div className="bg-white border-b border-gray-200 p-3 sticky top-0 z-30">
            <div className="relative flex items-center gap-2">
              <Search size={16} className="absolute left-3 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                autoFocus
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Descripción, código, marca…"
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
          <div className="p-4 space-y-2">
            {/* Botón escanear */}
            <button
              onClick={() => setScanning(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white
                         font-semibold py-4 rounded-2xl flex items-center justify-center gap-3
                         text-base shadow-sm transition-colors"
            >
              <ScanLine size={22} />
              Escanear Producto
            </button>
            {/* Botón buscar */}
            <button
              onClick={() => { setSearchMode(true); setTimeout(() => searchRef.current?.focus(), 50); }}
              className="w-full bg-white hover:bg-gray-50 text-gray-600 font-medium py-3 rounded-2xl
                         flex items-center justify-center gap-2 text-sm border border-gray-200
                         shadow-sm transition-colors"
            >
              <Search size={16} className="text-gray-400" />
              Buscar por nombre o código
            </button>

            {/* ── Fila Cliente + Precio ── */}
            <div className="flex gap-2">
              <button
                onClick={() => setClientModal(true)}
                className="flex-1 flex items-center gap-2 px-3 py-2 bg-white border border-gray-200
                           rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50
                           shadow-sm transition-colors overflow-hidden"
              >
                <User size={13} className="flex-shrink-0 text-gray-400" />
                <span className="truncate">
                  {selectedClient ? selectedClient.Nombre : 'Sin cliente'}
                </span>
                <ChevronRight size={12} className="flex-shrink-0 text-gray-400 ml-auto" />
              </button>
              <button
                onClick={() => setPriceModal(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                            border shadow-sm transition-colors whitespace-nowrap
                            ${priceLevel === DEFAULT_PRICE_LEVEL
                              ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              : 'bg-orange-50 border-orange-200 text-orange-700'}`}
              >
                <Tag size={12} />
                {PRICE_LEVELS[priceLevel]}
                <ChevronDown size={12} />
              </button>
            </div>
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
              results.map(p => {
                const stock = Number(p.Stock_Actual);
                const price = resolvePrice(p, priceLevel);
                const out   = stock <= 0;
                return (
                  <button
                    key={p.Bar_code}
                    onClick={() => !out && handleAdd(p)}
                    disabled={out}
                    className={`w-full bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm
                                border border-gray-100 text-left transition-all active:scale-[0.98]
                                ${out ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                  >
                    <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-500 font-bold">{p.Descripcion?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{p.Descripcion}</p>
                      <p className="text-xs text-gray-400">
                        {out
                          ? 'Sin stock'
                          : `Stock: ${stock} (A1: ${Number(p.Almacen_1)} | A2: ${Number(p.Almacen_2)})`}
                      </p>
                      {p.Marca && <p className="text-xs text-gray-300">{p.Marca}</p>}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="font-bold text-orange-600 text-sm">${price.toLocaleString('es-MX')}</p>
                      <p className="text-xs text-gray-300">{p.Unidad || ''}</p>
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

        {/* Carrito */}
        {!searchMode && (
          cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300 px-6 select-none">
              <ShoppingCart size={56} strokeWidth={1} />
              <p className="mt-3 text-sm font-medium text-gray-400">El carrito está vacío</p>
              <p className="text-xs text-gray-300 mt-1">Escanea o busca un producto</p>
            </div>
          ) : (
            <div className="px-4 pb-2 space-y-2">
              {cart.items.map(item => (
                <div key={item.Bar_code}
                  className="bg-white rounded-xl p-3 flex items-start gap-3 shadow-sm border border-gray-100">
                  <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-orange-500 font-bold text-sm">
                      {item.Descripcion?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.Descripcion}</p>
                    <p className="text-xs text-gray-400">
                      ${item.activePrice.toLocaleString('es-MX')} c/u
                    </p>
                    {/* Selector de almacén */}
                    <div className="flex gap-1 mt-1">
                      {['Almacen_1', 'Almacen_2'].map(wh => (
                        <button
                          key={wh}
                          onClick={() => setItemWarehouse(item.Bar_code, wh)}
                          className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors
                            ${item.warehouse === wh
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {wh === 'Almacen_1' ? 'A1' : 'A2'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => updateQuantity(item.Bar_code, item.quantity - 1)}
                      className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.Bar_code, item.quantity + 1)}
                      disabled={item.quantity >= Number(item.Stock_Actual)}
                      className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white
                                 flex items-center justify-center disabled:opacity-30">
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeItem(item.Bar_code)}
                      className="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-400
                                 flex items-center justify-center ml-1">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="w-16 text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">
                      ${(item.activePrice * item.quantity).toLocaleString('es-MX')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Panel inferior fijo ─────────────────────────────────────────── */}
      <div className="fixed bottom-14 left-0 right-0 z-30 bg-white border-t border-gray-200
                      px-4 py-3 space-y-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        {/* Total + nivel de precio activo */}
        <div className="flex justify-between items-center">
          <div>
            <span className="text-gray-500 text-sm font-medium">Total</span>
            {priceLevel !== DEFAULT_PRICE_LEVEL && (
              <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-md font-medium">
                {PRICE_LEVELS[priceLevel]}
              </span>
            )}
          </div>
          <span className="text-2xl font-bold text-gray-900">
            ${total.toLocaleString('es-MX')}
          </span>
        </div>

        {/* Método de pago */}
        <div className="relative">
          <select
            value={payMethod}
            onChange={e => setPayMethod(e.target.value)}
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

      {/* ── Modales ─────────────────────────────────────────────────────── */}
      {scanning && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setScanning(false)}
          cartCount={cart.items.reduce((s, i) => s + i.quantity, 0)}
          cartTotal={total}
          onCheckout={() => { setScanning(false); setShowPay(true); }}
          cartItems={cart.items}
          onRemoveItem={removeItem}
          onUpdateQuantity={updateQuantity}
          onSetWarehouse={setItemWarehouse}
          priceLevel={priceLevel}
        />
      )}

      {showPay && (
        <PaymentModal
          total={total}
          defaultMethod={payMethod}
          defaultCustomer={selectedClient?.Nombre || ''}
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

      {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}

      {showPriceModal && (
        <PriceLevelModal
          current={priceLevel}
          onSelect={handlePriceLevel}
          onClose={() => setPriceModal(false)}
        />
      )}

      {showClientModal && (
        <ClientModal
          clients={clients}
          selected={selectedClient}
          onSelect={handleClientSelect}
          onClose={() => setClientModal(false)}
        />
      )}
    </>
  );
}
