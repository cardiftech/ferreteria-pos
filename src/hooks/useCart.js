import { useReducer, useCallback } from 'react';

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(
        (i) => i.Codigo_Barras === action.payload.Codigo_Barras
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.Codigo_Barras === existing.Codigo_Barras
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.payload, quantity: 1 }],
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.Codigo_Barras !== action.payload),
      };
    case 'UPDATE_QTY': {
      const { barcode, quantity } = action.payload;
      if (quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((i) => i.Codigo_Barras !== barcode),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.Codigo_Barras === barcode ? { ...i, quantity } : i
        ),
      };
    }
    case 'CLEAR':
      return { items: [] };
    default:
      return state;
  }
}

export function useCart() {
  const [cart, dispatch] = useReducer(cartReducer, { items: [] });

  const addItem = useCallback(
    (product) => dispatch({ type: 'ADD_ITEM', payload: product }),
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
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const total = cart.items.reduce(
    (sum, item) => sum + Number(item.Precio_Venta) * item.quantity,
    0
  );
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return { cart, total, itemCount, addItem, removeItem, updateQuantity, clearCart };
}
