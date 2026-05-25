import { useReducer, useCallback } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Redondea a 2 decimales para evitar errores IEEE 754 (p.ej. 19.99×3 = 59.97000…1) */
export const round2 = (n) => Math.round(n * 100) / 100;

// ── Constantes de niveles de precio ──────────────────────────────────────────
export const PRICE_LEVELS = {
  Precio_publico_IVA:       'Precio público',
  Precio_medio_mayoreo_IVA: 'Medio mayoreo',
  Precio_mayoreo_IVA:       'Mayoreo',
  Precio_distribuidor_IVA:  'Distribuidor',
};

export const DEFAULT_PRICE_LEVEL = 'Precio_medio_mayoreo_IVA';

// Resuelve el precio activo de un producto para un nivel dado
export function resolvePrice(product, priceLevel) {
  return (
    Number(product[priceLevel]) ||
    Number(product.Precio_publico_IVA) ||
    0
  );
}

// Almacén preferido al agregar un producto: Local primero, Bodeguita solo si Local = 0
export function autoWarehouse(product) {
  return Number(product.Local) > 0 ? 'Local' : 'Bodeguita';
}

// ── Reducer ──────────────────────────────────────────────────────────────────
function cartReducer(state, action) {
  switch (action.type) {

    case 'ADD_ITEM': {
      const { product, priceLevel: itemLevel, warehouse } = action.payload;
      // Usa el nivel del carrito si no se especifica explícitamente.
      // Esto evita que el primer producto use el nivel default cuando el
      // cajero cambió el nivel antes de agregar cualquier ítem.
      const priceLevel = itemLevel ?? state.priceLevel;
      const existing = state.items.find(i => i.Bar_code === product.Bar_code);
      if (existing) {
        // Si se solicita cambiar de almacén (p.ej. Local agotado → Bodeguita),
        // aplicar el cambio y sumar 1 unidad, clampando al stock disponible.
        if (warehouse && warehouse !== existing.warehouse) {
          const whStock = Number(warehouse === 'Bodeguita' ? product.Bodeguita : product.Local);
          return {
            ...state,
            items: state.items.map(i =>
              i.Bar_code === product.Bar_code
                ? { ...i, warehouse, quantity: Math.min(i.quantity + 1, whStock > 0 ? whStock : i.quantity) }
                : i
            ),
          };
        }
        return {
          ...state,
          items: state.items.map(i =>
            i.Bar_code === product.Bar_code
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            ...product,
            quantity:    1,
            priceLevel,
            activePrice: resolvePrice(product, priceLevel),
            warehouse:   warehouse || autoWarehouse(product),
          },
        ],
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(i => i.Bar_code !== action.payload),
      };

    case 'UPDATE_QTY': {
      const { barcode, quantity } = action.payload;
      if (quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(i => i.Bar_code !== barcode),
        };
      }
      return {
        ...state,
        items: state.items.map(i => {
          if (i.Bar_code !== barcode) return i;
          // Clamp: nunca superar el stock disponible en el almacén activo
          const whStock  = Number(i.warehouse === 'Bodeguita' ? i.Bodeguita : i.Local);
          const clamped  = whStock > 0 ? Math.min(quantity, whStock) : quantity;
          return { ...i, quantity: clamped };
        }),
      };
    }

    // Guarda el nivel en el estado del carrito Y recalcula ítems existentes
    case 'CHANGE_PRICE_LEVEL': {
      const { priceLevel } = action.payload;
      return {
        ...state,
        priceLevel,                           // persiste para futuros ADD_ITEM
        items: state.items.map(i => ({
          ...i,
          priceLevel,
          activePrice: resolvePrice(i, priceLevel),
        })),
      };
    }

    // Cambia el almacén de un ítem específico y ajusta la cantidad si supera el stock disponible
    case 'SET_WAREHOUSE': {
      const { barcode, warehouse } = action.payload;
      return {
        ...state,
        items: state.items.map(i => {
          if (i.Bar_code !== barcode) return i;
          const whStock = Number(warehouse === 'Bodeguita' ? i.Bodeguita : i.Local);
          return {
            ...i,
            warehouse,
            // Clamp: si el nuevo almacén tiene menos stock que la cantidad actual,
            // se reduce automáticamente para evitar registrar stock negativo.
            quantity: Math.min(i.quantity, whStock > 0 ? whStock : 1),
          };
        }),
      };
    }

    case 'CLEAR':
      return { items: [], priceLevel: state.priceLevel }; // mantiene el nivel al limpiar

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useCart() {
  const [cart, dispatch] = useReducer(cartReducer, { items: [], priceLevel: DEFAULT_PRICE_LEVEL });

  const addItem = useCallback(
    (product, { priceLevel = DEFAULT_PRICE_LEVEL, warehouse } = {}) =>
      dispatch({ type: 'ADD_ITEM', payload: { product, priceLevel, warehouse } }),
    []
  );

  const removeItem = useCallback(
    (barcode) => dispatch({ type: 'REMOVE_ITEM', payload: barcode }),
    []
  );

  const updateQuantity = useCallback(
    (barcode, quantity) =>
      dispatch({ type: 'UPDATE_QTY', payload: { barcode, quantity } }),
    []
  );

  const changePriceLevel = useCallback(
    (priceLevel) => dispatch({ type: 'CHANGE_PRICE_LEVEL', payload: { priceLevel } }),
    []
  );

  const setItemWarehouse = useCallback(
    (barcode, warehouse) =>
      dispatch({ type: 'SET_WAREHOUSE', payload: { barcode, warehouse } }),
    []
  );

  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const total = round2(
    cart.items.reduce((sum, item) => sum + item.activePrice * item.quantity, 0)
  );

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    cart, total, itemCount,
    addItem, removeItem, updateQuantity, clearCart,
    changePriceLevel, setItemWarehouse,
  };
}
