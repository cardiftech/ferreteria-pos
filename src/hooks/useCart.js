import { useReducer, useCallback } from 'react';

// ── Constantes de niveles de precio ──────────────────────────────────────────
export const PRICE_LEVELS = {
  Precio_publico_IVA:       'Precio público',
  Precio_medio_mayoreo_IVA: 'Medio mayoreo',
  Precio_mayoreo_IVA:       'Mayoreo',
  Precio_distribuidor_IVA:  'Distribuidor',
};

export const DEFAULT_PRICE_LEVEL = 'Precio_publico_IVA';

// Resuelve el precio activo de un producto para un nivel dado
export function resolvePrice(product, priceLevel) {
  return (
    Number(product[priceLevel]) ||
    Number(product.Precio_publico_IVA) ||
    0
  );
}

// Almacén con más stock (o Almacen_1 por defecto)
export function autoWarehouse(product) {
  return Number(product.Almacen_1) >= Number(product.Almacen_2)
    ? 'Almacen_1'
    : 'Almacen_2';
}

// ── Reducer ──────────────────────────────────────────────────────────────────
function cartReducer(state, action) {
  switch (action.type) {

    case 'ADD_ITEM': {
      const { product, priceLevel, warehouse } = action.payload;
      const existing = state.items.find(i => i.Bar_code === product.Bar_code);
      if (existing) {
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
        items: state.items.map(i =>
          i.Bar_code === barcode ? { ...i, quantity } : i
        ),
      };
    }

    // Recalcula activePrice de todos los ítems al cambiar nivel de precio
    case 'CHANGE_PRICE_LEVEL': {
      const { priceLevel } = action.payload;
      return {
        ...state,
        items: state.items.map(i => ({
          ...i,
          priceLevel,
          activePrice: resolvePrice(i, priceLevel),
        })),
      };
    }

    // Cambia el almacén de un ítem específico
    case 'SET_WAREHOUSE':
      return {
        ...state,
        items: state.items.map(i =>
          i.Bar_code === action.payload.barcode
            ? { ...i, warehouse: action.payload.warehouse }
            : i
        ),
      };

    case 'CLEAR':
      return { items: [] };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useCart() {
  const [cart, dispatch] = useReducer(cartReducer, { items: [] });

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

  const total = cart.items.reduce(
    (sum, item) => sum + item.activePrice * item.quantity,
    0
  );

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    cart, total, itemCount,
    addItem, removeItem, updateQuantity, clearCart,
    changePriceLevel, setItemWarehouse,
  };
}
