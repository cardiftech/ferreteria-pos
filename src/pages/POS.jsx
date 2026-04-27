import { useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ScanLine, Search, X, ShoppingCart, Plus, Minus, Trash2,
  CheckCircle2, ChevronDown, ChevronRight, User, Tag, UserPlus, ArrowLeft,
} from 'lucide-react';
import { useInventory }  from '../hooks/useInventory';
import { useSearch }     from '../hooks/useSearch';
import { useClients }    from '../hooks/useClients';
import {
  useCart, PRICE_LEVELS, DEFAULT_PRICE_LEVEL,
  resolvePrice, autoWarehouse, round2,
} from '../hooks/useCart';
import { useApp }        from '../context/AppContext';
import { api }                  from '../services/api';
import { decrementLocalStock }  from '../services/sync';
import db                       from '../services/db';
import SearchInput       from '../components/shared/SearchInput';
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

function ClientModal({ clients, selected, onSelect, onClose, onClientAdded }) {
  const [view, setView]   = useState('list');   // 'list' | 'new'
  const [q, setQ]         = useState('');
  // ── formulario nuevo cliente ──
  const [nombre,     setNombre]     = useState('');
  const [telefono,   setTelefono]   = useState('');
  const [tipoPrecio, setTipoPrecio] = useState(DEFAULT_PRICE_LEVEL);
  const [saving,     setSaving]     = useState(false);
  const [formErr,    setFormErr]    = useState('');

  const filtered = clients.filter(c =>
    c.Nombre.toLowerCase().includes(q.toLowerCase()) ||
    String(c.Telefono).includes(q)
  );

  const handleAddClient = async () => {
    if (!nombre.trim()) { setFormErr('El nombre es obligatorio'); return; }
    setSaving(true);
    setFormErr('');
    try {
      const result = await api.addClient({
        Nombre:      nombre.trim(),
        Telefono:    telefono.trim(),
        Tipo_Precio: tipoPrecio,
      });
      if (result?.error) throw new Error(result.error);
      // Guarda en IndexedDB local también
      const newClient = {
        ID_Cliente:  result.ID_Cliente,
        Nombre:      nombre.trim(),
        Telefono:    telefono.trim(),
        Tipo_Precio: tipoPrecio,
      };
      await db.clients.put(newClient);
      onClientAdded?.();          // recarga la lista en useClients
      onSelect(newClient);        // selecciona el cliente recién creado
      onClose();
    } catch (err) {
      setFormErr(err.message || 'Error al guardar cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[80dvh]">

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
          {view === 'new' ? (
            <button
              onClick={() => { setView('list'); setFormErr(''); }}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={17} />
              <span className="text-sm font-medium">Volver</span>
            </button>
          ) : (
            <h3 className="font-bold text-gray-900">Seleccionar cliente</h3>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* ── Vista: lista ── */}
        {view === 'list' && (
          <>
            <div className="px-4 py-3 border-b flex gap-2 flex-shrink-0">
              <input
                autoFocus
                type="search"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar por nombre o teléfono…"
                className="flex-1 px-3 py-2 bg-gray-100 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                onClick={() => setView('new')}
                title="Agregar nuevo cliente"
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500
                           hover:bg-orange-600 text-white text-xs font-semibold rounded-xl
                           transition-colors shadow-sm"
              >
                <UserPlus size={14} />
                Nuevo
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pb-6">
              {/* Sin cliente — solo visible cuando el buscador está vacío */}
              {!q.trim() && (
                <button
                  onClick={() => { onSelect(null); onClose(); }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50
                              ${!selected ? 'text-orange-600' : 'text-gray-500'}`}
                >
                  <User size={16} />
                  <span className="text-sm">Sin cliente (medio mayoreo)</span>
                  {!selected && <CheckCircle2 size={16} className="text-orange-500 ml-auto" />}
                </button>
              )}

              {filtered.length === 0 && q.trim() ? (
                <p className="text-center text-sm text-gray-400 py-6">Sin resultados</p>
              ) : (
                filtered.map(c => (
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
                ))
              )}
            </div>
          </>
        )}

        {/* ── Vista: formulario nuevo cliente ── */}
        {view === 'new' && (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <p className="text-sm text-gray-500">Completa los datos del cliente frecuente.</p>

            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre completo o empresa"
                className="w-full px-3 py-2.5 bg-gray-100 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2.5 bg-gray-100 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Tipo de precio */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Precio asignado</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PRICE_LEVELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTipoPrecio(key)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors text-left
                                ${tipoPrecio === key
                                  ? 'bg-orange-50 border-orange-400 text-orange-700'
                                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {tipoPrecio === key && <span className="mr-1">✓</span>}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {formErr && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{formErr}</p>
            )}

            {/* Guardar */}
            <button
              onClick={handleAddClient}
              disabled={saving || !nombre.trim()}
              className="w-full py-3 rounded-2xl bg-orange-500 hover:bg-orange-600
                         disabled:bg-gray-200 disabled:text-gray-400
                         text-white font-semibold text-sm transition-colors flex items-center
                         justify-center gap-2"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <UserPlus size={16} />
              )}
              {saving ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── POS principal ─────────────────────────────────────────────────────────────
export default function POS() {
  const [scanning, setScanning]           = useState(false);
  const [searchMode, setSearchMode]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [payMethod, setPayMethod]         = useState('Efectivo');
  const [showPay, setShowPay]             = useState(false);
  const [receipt, setReceipt]             = useState(null);
  const [priceLevel, setPriceLevel]       = useState(DEFAULT_PRICE_LEVEL);
  const [selectedClient, setClient]       = useState(null);
  const [showPriceModal, setPriceModal]   = useState(false);
  const [showClientModal, setClientModal] = useState(false);
  const [lastScanned, setLastScanned]     = useState(''); // feedback escáner físico
  const [confirmClear, setConfirmClear]   = useState(false);
  const searchRef          = useRef(null);
  const resultsRef         = useRef(null);  // scroll container para el virtualizador
  const searchBarRef       = useRef(null);  // barra de búsqueda — medida con ResizeObserver
  const physicalScan       = useRef(null);  // siempre apunta a la fn de escaneo más reciente
  const [searchBarH, setSearchBarH] = useState(64); // altura medida del search bar (px)

  const { products }                     = useInventory();
  const { clients, reload: reloadClients } = useClients();
  const { notify, state, sync }          = useApp();
  // searchQuery se actualiza desde SearchInput ya debounced (150ms)
  // → el padre (este componente) NO re-renderiza en cada tecla
  const { results, truncated: searchTruncated } = useSearch(products, searchQuery);

  // Callback estable para SearchInput — evita que el hijo se re-suscriba innecesariamente
  const handleSearch = useCallback((val) => setSearchQuery(val), []);

  // Virtual scrolling — solo renderiza ~20 tarjetas en el DOM sin importar
  // cuántos resultados haya (crítico para dispositivos lentos con 15k productos)
  const rowVirtualizer = useVirtualizer({
    count:           results.length,
    getScrollElement: () => resultsRef.current,
    estimateSize:    () => 82,   // px por tarjeta (ajuste fino automático)
    overscan:        4,
  });

  const {
    cart, total, addItem, removeItem, updateQuantity, clearCart,
    changePriceLevel, setItemWarehouse,
  } = useCart();

  // ── Escáner físico (USB / Bluetooth) ────────────────────────────────────────
  // Los escáneres actúan como teclado: escriben el código muy rápido + Enter.
  // Actualizamos physicalScan.current en cada render para que siempre capture
  // el estado más reciente sin necesidad de re-registrar el listener.
  physicalScan.current = (barcode) => {
    const found = products.find(p => String(p.Bar_code).trim() === barcode.trim());
    if (found) {
      handleAdd(found);
      setLastScanned(`✓ ${found.Descripcion}`);
    } else {
      notify(`Código no encontrado: ${barcode}`, 'warning');
      setLastScanned('');
    }
  };

  // Registra el listener UNA sola vez al montar
  useEffect(() => {
    let buffer    = '';
    let resetTimer = null;

    const onKey = (e) => {
      // Si hay un input/select activo (búsqueda manual), no interferir
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter') {
        const code = buffer.trim();
        buffer = '';
        if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
        if (code.length >= 2) physicalScan.current?.(code);
        return;
      }

      // Solo caracteres imprimibles (ignora Shift, Ctrl, F1…)
      if (e.key.length !== 1) return;

      buffer += e.key;
      // Si pasan 80 ms sin nueva tecla, resetea (descarta tecleo humano lento)
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { buffer = ''; }, 150);
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpia el mensaje de feedback tras 2 s
  useEffect(() => {
    if (!lastScanned) return;
    const t = setTimeout(() => setLastScanned(''), 2000);
    return () => clearTimeout(t);
  }, [lastScanned]);

  // #7 — Resetea el scroll del virtualizador al inicio en cada nueva búsqueda.
  // Sin esto el usuario ve resultados de "clavo" con el scroll posicionado en
  // el resultado 40 de la búsqueda anterior de "tornillo".
  useEffect(() => {
    resultsRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [searchQuery]);

  // Mide la altura real del search bar con ResizeObserver para que el contenedor
  // virtual tenga exactamente el espacio disponible en cualquier dispositivo/navegador.
  // Evita el hardcode de 180px que dejaba resultados ocultos bajo el panel inferior.
  useEffect(() => {
    const el = searchBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      setSearchBarH(Math.ceil(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [searchMode]); // re-observe cuando aparece/desaparece el search bar

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
    const inCart    = cart.items.find(i => i.Bar_code === product.Bar_code);
    const wh        = inCart?.warehouse || autoWarehouse(product);
    const whStock   = Number(wh === 'Bodeguita' ? product.Bodeguita : product.Local);
    const inCartQty = inCart?.quantity ?? 0;

    if (inCartQty >= whStock) {
      // Avisa si el otro almacén tiene stock disponible.
      // Compara contra 0, no contra inCartQty: si Bodeguita tiene 3 unidades
      // y Local ya está lleno en el carrito, "3 > 0" indica correctamente
      // que hay stock disponible en Bodeguita aunque sea igual a lo del carrito.
      const otherWh    = wh === 'Bodeguita' ? 'Local' : 'Bodeguita';
      const otherStock = Number(wh === 'Bodeguita' ? product.Local : product.Bodeguita);
      if (otherStock > 0) {
        notify(`Sin stock en ${wh} — hay ${otherStock} uds en ${otherWh}`, 'warning');
      } else {
        notify(`Sin stock disponible (${Number(product.Stock_Actual)} uds en total)`, 'warning');
      }
      return;
    }
    addItem(product, { priceLevel, warehouse: wh });
    setSearchQuery('');
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

    const salePayload = {
      sale: {
        total,
        paymentMethod: payData.method,
        customer:      payData.customer || selectedClient?.Nombre || '',
        notas:         payData.notes || '',
      },
      items: cart.items.map(i => ({
        Bar_code:    i.Bar_code,
        Descripcion: i.Descripcion,
        quantity:    i.quantity,
        activePrice: i.activePrice,
        priceLevel:  i.priceLevel,
        warehouse:   i.warehouse,
        Codigo_SAT:  i.Codigo_SAT || '',
      })),
    };

    // ── Respaldo local ANTES de llamar a la API ────────────────────────────
    // Si la red se corta exactamente mientras el request está en vuelo,
    // esta entrada (synced: 0) queda como evidencia de la venta intentada.
    // El carrito NO se limpia si la API falla → el cajero puede reintentar.
    const pendingId = await db.pendingSales
      .add({ ...salePayload, timestamp: new Date().toISOString(), synced: 0 })
      .catch(() => null);

    const result = await api.registerSale(salePayload);
    if (result?.error) throw new Error(result.error);

    // API exitosa: marca la entrada como sincronizada
    if (pendingId != null) {
      db.pendingSales.update(pendingId, { synced: 1, saleId: result.saleId }).catch(() => {});
    }

    setReceipt({
      saleId:        result.saleId,
      items:         [...cart.items],
      total,
      paymentMethod: payData.method,
      cashReceived:  payData.cashReceived || 0,
      change,
      customer:      payData.customer || selectedClient?.Nombre || '',
      notas:         payData.notes   || '',
      timestamp:     new Date().toISOString(),
    });

    // Descuenta el stock localmente de inmediato — sin sync completo
    decrementLocalStock(cart.items).catch(() => {});
    clearCart();
    setShowPay(false);
  };

  const canFinalize = cart.items.length > 0 && state.isOnline;

  return (
    <>
      {/* ── Área principal ─────────────────────────────────────────────── */}
      <div className={BOTTOM_PANEL_H}>

        {/* Búsqueda por texto */}
        {searchMode ? (
          <div ref={searchBarRef} className="bg-white border-b border-gray-200 p-3 sticky top-0 z-30">
            {/* SearchInput gestiona su propio valor internamente →
                solo él re-renderiza en cada tecla, nunca POS completo */}
            <SearchInput
              ref={searchRef}
              onSearch={handleSearch}
              onClose={() => { setSearchMode(false); setSearchQuery(''); setConfirmClear(false); }}
              placeholder="Descripción, código, marca…"
            />
          </div>
        ) : (
          <div className="p-4 space-y-2">

            {/* ── Fila principal: búsqueda + cámara (pequeña) ── */}
            <div className="flex gap-2">
              {/* Buscar — protagonista */}
              <button
                onClick={() => {
                  setSearchMode(true);
                  setConfirmClear(false); // cancela el confirm de vaciar si estaba activo
                  setTimeout(() => searchRef.current?.focus(), 50);
                }}
                className="flex-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white
                           font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2
                           text-sm shadow-sm transition-colors"
              >
                <Search size={17} />
                Buscar producto
              </button>

              {/* Cámara — discreto, solo emergencias */}
              <button
                onClick={() => setScanning(true)}
                title="Escanear con cámara"
                className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-3.5
                           bg-white border border-gray-200 rounded-2xl text-gray-400
                           hover:bg-gray-50 hover:text-gray-600 shadow-sm transition-colors"
              >
                <ScanLine size={18} />
              </button>
            </div>

            {/* Indicador escáner físico */}
            <div className={`flex items-center justify-center gap-2 py-1.5 rounded-xl text-xs
                             transition-all duration-300
                             ${lastScanned
                               ? 'bg-green-50 text-green-700 font-medium'
                               : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors
                                ${lastScanned ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              {lastScanned || 'Escáner físico listo'}
            </div>

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

        {/* Resultados de búsqueda — lista virtual (máx ~20 nodos en el DOM) */}
        {searchMode && searchQuery.trim().length > 0 && (
          results.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8 px-4">
              Sin resultados para "{searchQuery}"
            </p>
          ) : (
            <div className="px-3 pt-1">
              {searchTruncated && (
                <p className="text-center text-xs text-orange-500 bg-orange-50 py-2 rounded-xl mb-2">
                  Mostrando los primeros 80 — escribe más para afinar la búsqueda
                </p>
              )}

              {/* Contenedor con scroll propio — el virtualizador solo renderiza
                  los ítems visibles dentro de esta ventana.
                  Altura = viewport - navbar(56px) - searchBar(medido) - panel+nav(210px).
                  ResizeObserver actualiza searchBarH cuando el tamaño cambia (orientación,
                  barra de URL del navegador, teclado virtual, etc.). */}
              <div
                ref={resultsRef}
                className="overflow-y-auto"
                style={{ height: `calc(100dvh - 56px - ${searchBarH}px - 210px)` }}
              >
                <div
                  style={{
                    height:   `${rowVirtualizer.getTotalSize()}px`,
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map(virtualItem => {
                    const p     = results[virtualItem.index];
                    const stock = Number(p.Stock_Actual);
                    const price = resolvePrice(p, priceLevel);
                    const out   = stock <= 0;
                    return (
                      <div
                        key={p.Bar_code}
                        style={{
                          position:  'absolute',
                          top:       0,
                          left:      0,
                          width:     '100%',
                          transform: `translateY(${virtualItem.start}px)`,
                          padding:   '4px 0',
                        }}
                      >
                        <button
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
                                : `Stock: ${stock} (Local: ${Number(p.Local)} | Bodeguita: ${Number(p.Bodeguita)})`}
                            </p>
                            {p.PROVEEDOR && <p className="text-xs text-gray-300">{p.PROVEEDOR}</p>}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="font-bold text-orange-600 text-sm">${price.toLocaleString('es-MX')}</p>
                            <p className="text-xs text-gray-300">{p.Unidad || ''}</p>
                            <div className="mt-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center ml-auto">
                              <Plus size={12} className="text-white" />
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
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
              {/* Cabecera del carrito con botón de vaciar */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {cart.items.length} {cart.items.length === 1 ? 'producto' : 'productos'}
                </span>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">¿Vaciar todo?</span>
                    <button
                      onClick={() => { clearCart(); setConfirmClear(false); }}
                      className="px-2.5 py-1 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                      Sí, vaciar
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-400
                               hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} />
                    Vaciar
                  </button>
                )}
              </div>
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
                    {/* Selector de almacén — deshabilitado si el destino no tiene stock */}
                    <div className="flex gap-1 mt-1">
                      {['Local', 'Bodeguita'].map(wh => {
                        const whStock  = Number(wh === 'Bodeguita' ? item.Bodeguita : item.Local);
                        const isActive = item.warehouse === wh;
                        const canUse   = isActive || whStock > 0;
                        return (
                          <button
                            key={wh}
                            onClick={() => canUse && setItemWarehouse(item.Bar_code, wh)}
                            disabled={!canUse}
                            title={`${wh}: ${whStock} uds disponibles`}
                            className={`px-2 py-0.5 text-xs rounded-md font-medium transition-colors
                              ${isActive
                                ? 'bg-orange-500 text-white'
                                : canUse
                                  ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  : 'bg-gray-50 text-gray-300 cursor-not-allowed line-through'}`}
                          >
                            {wh} <span className={isActive ? 'opacity-75' : ''}>{whStock}</span>
                          </button>
                        );
                      })}
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
                      disabled={item.quantity >= Number(item.warehouse === 'Bodeguita' ? item.Bodeguita : item.Local)}
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
                      ${round2(item.activePrice * item.quantity).toLocaleString('es-MX')}
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
              // Sincroniza el selector del panel con el método usado en el modal
              setPayMethod(data.method);
            } catch (err) {
              notify(err.message || 'Error al registrar la venta', 'error');
              throw err;
            }
          }}
          onCancel={() => setShowPay(false)}
        />
      )}

      {receipt && (
        <Receipt
          sale={receipt}
          notify={notify}
          onClose={() => {
            setReceipt(null);
            // Limpia el cliente y el nivel de precio para la siguiente venta.
            // Si no se limpia, el cajero podría cobrar al siguiente cliente
            // con el nivel de precio del anterior sin darse cuenta.
            setClient(null);
            handlePriceLevel(DEFAULT_PRICE_LEVEL);
          }}
        />
      )}

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
          onClientAdded={reloadClients}
        />
      )}
    </>
  );
}
