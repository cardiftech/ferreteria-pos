import { useState, useEffect, forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * Input de búsqueda completamente desacoplado del componente padre.
 *
 * POR QUÉ EXISTE:
 *   Si el <input> vive dentro de POS o Inventory, cada pulsación de tecla
 *   llama a setState en el padre → re-renderiza todo el árbol pesado
 *   (productos, carrito, hooks, etc.) → el carácter tarda en aparecer.
 *
 *   Al aislar el input aquí, solo este componente diminuto re-renderiza
 *   en cada tecla → el carácter aparece al instante.
 *   El padre recibe el valor debounced (150ms) una vez que el usuario
 *   deja de escribir, y solo entonces re-renderiza con nuevos resultados.
 *
 * Props:
 *   onSearch(value)   — se llama con el valor debounced tras 150ms de pausa
 *   onClose()         — opcional; si se pasa, muestra botón X que lo invoca
 *   placeholder       — texto de ayuda del input
 *   debounceMs        — milisegundos de debounce (default 150)
 *   inputClassName    — clases extra para el <input>
 *   wrapperClassName  — clases extra para el wrapper
 */
const SearchInput = forwardRef(function SearchInput(
  {
    onSearch,
    onClose,
    placeholder     = 'Buscar…',
    debounceMs      = 150,
    inputClassName  = '',
    wrapperClassName = '',
  },
  ref,
) {
  const [value, setValue]   = useState('');
  const debounced           = useDebounce(value, debounceMs);

  // Notifica al padre del valor debounced — NO en cada tecla
  useEffect(() => {
    onSearch(debounced);
  }, [debounced, onSearch]);

  const handleClear = () => {
    setValue('');
    onSearch('');   // notifica inmediatamente, sin esperar debounce
    onClose?.();
  };

  return (
    <div className={`relative flex items-center gap-2 ${wrapperClassName}`}>
      <Search
        size={16}
        className="absolute left-3 text-gray-400 pointer-events-none z-10"
      />
      <input
        ref={ref}
        autoFocus
        type="search"
        inputMode="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 py-2.5 bg-gray-100 rounded-xl text-sm
                    focus:outline-none focus:ring-2 focus:ring-orange-400
                    ${onClose ? 'pr-4' : 'pr-4'} ${inputClassName}`}
      />
      {onClose && (
        <button
          onClick={handleClear}
          className="flex-shrink-0 p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
});

export default SearchInput;
