import { useState, useEffect } from 'react';

/**
 * Retrasa la actualización de un valor hasta que deje de cambiar.
 * Evita ejecutar búsquedas pesadas en cada pulsación de tecla.
 */
export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
