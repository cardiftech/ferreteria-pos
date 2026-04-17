import { useState } from 'react';
import { useInventory }  from '../hooks/useInventory';
import { useSearch }     from '../hooks/useSearch';
import { useCart }       from '../hooks/useCart';
import { useApp }        from '../context/AppContext';
import { api }           from '../services/api';
import SearchBar         from '../components/pos/SearchBar';
import ProductCard       from '../components/pos/ProductCard';
import Cart              from '../components/pos/Cart';
import PaymentModal      from '../components/pos/PaymentModal';
import Receipt           from '../components/pos/Receipt';

export default function POS() {
  const [query, setQuery]       = useState('');
  const [showPay, setShowPay]   = useState(false);
  const [receipt, setReceipt]   = useState(null);

  const { products, loading, reload }   = useInventory();
  const { notify, state, sync: syncFn } = useApp();
  const results = useSearch(products, query);
  const { cart, total, addItem, removeItem, updateQuantity, clearCart } = useCart();

  const handleAdd = (product) => {
    const inCart   = cart.items.find((i) => i.Codigo_Barras === product.Codigo_Barras);
    const qty      = inCart?.quantity ?? 0;
    if (qty >= Number(product.Stock_Actual)) {
      notify(`Stock insuficiente (disponible: ${product.Stock_Actual})`, 'warning');
      return;
    }
    addItem(product);
    setQuery('');
  };

  const handleConfirmSale = async (payData) => {
    const result = await api.registerSale({
      sale: {
        total,
        paymentMethod: payData.method,
        customer: payData.customer,
        notes:    payData.notes,
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
      items:         cart.items,
      total,
      paymentMethod: payData.method,
      cashReceived:  payData.cashReceived || 0,
      change,
      customer:      payData.customer,
      timestamp:     new Date().toISOString(),
    });

    clearCart();
    setShowPay(false);

    // Actualiza inventario local en segundo plano
    syncFn(true).then(reload).catch(() => {});
  };

  const hasQuery = query.trim().length >= 1;

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Panel izquierdo: buscador + resultados */}
        <section className="lg:col-span-3 space-y-3">
          <SearchBar value={query} onChange={setQuery} />

          {/* Sin búsqueda activa → hint vacío */}
          {!hasQuery && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-400">Busca un producto o usa el escáner</p>
              <p className="text-xs text-gray-300 mt-1">Escribe el nombre, código o escanea el código de barras</p>
            </div>
          )}

          {/* Buscando → spinner o resultados */}
          {hasQuery && loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {hasQuery && !loading && results.length === 0 && (
            <div className="card p-10 text-center text-gray-400">
              <p className="text-sm">Sin resultados para <span className="font-medium text-gray-600">"{query}"</span></p>
            </div>
          )}

          {hasQuery && !loading && results.length > 0 && (
            <div className="space-y-2">
              {results.map((p) => (
                <ProductCard key={p.Codigo_Barras} product={p} onAdd={handleAdd} />
              ))}
            </div>
          )}
        </section>

        {/* Panel derecho: carrito */}
        <section className="lg:col-span-2">
          <div className="lg:sticky lg:top-[4.5rem]">
            <Cart
              items={cart.items}
              total={total}
              onUpdate={updateQuantity}
              onRemove={removeItem}
              onCheckout={() => setShowPay(true)}
              isOnline={state.isOnline}
            />
          </div>
        </section>

      </div>

      {showPay && (
        <PaymentModal
          total={total}
          onConfirm={async (data) => {
            try {
              await handleConfirmSale(data);
            } catch (err) {
              notify(err.message || 'Error al registrar la venta', 'error');
              throw err; // permite que PaymentModal quite el spinner
            }
          }}
          onCancel={() => setShowPay(false)}
        />
      )}

      {receipt && (
        <Receipt sale={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}
