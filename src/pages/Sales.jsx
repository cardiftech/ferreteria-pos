/**
 * Sales — monitor de ventas: refleja la hoja VENTAS de Google Sheets con edición
 * básica (Total, Método de pago, Cliente, Notas) y borrado de registros erróneos.
 *
 * Solo online: las ventas viven en Sheets, no en la BD local. Muestra un aviso
 * claro si el Code.gs aún no tiene los endpoints nuevos (getSales/updateSale).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, WifiOff, Receipt, AlertTriangle, Loader2, Search, Clock, User,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';
import SearchInput from '../components/shared/SearchInput';
import SaleEditModal from '../components/sales/SaleEditModal';

const FETCH_LIMIT = 200;

const METHOD_STYLE = {
  Efectivo:      'bg-green-50 text-green-700',
  Tarjeta:       'bg-blue-50 text-blue-700',
  Transferencia: 'bg-indigo-50 text-indigo-700',
};

function fmtDateTime(iso) {
  if (!iso) return '';
  try { return format(new Date(iso), "dd MMM · HH:mm", { locale: es }); }
  catch { return String(iso); }
}

export default function Sales() {
  const { state, notify } = useApp();
  const [sales,       setSales]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [errorKind,   setErrorKind]   = useState(null);   // null | 'offline' | 'gas' | 'other'
  const [errorMsg,    setErrorMsg]    = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editSale,    setEditSale]    = useState(null);
  const [total,       setTotalCount]  = useState(0);      // total de filas en la hoja
  const [readOnly,    setReadOnly]    = useState(false);  // GAS sin endpoints de edición

  const load = useCallback(async () => {
    if (!navigator.onLine) { setErrorKind('offline'); return; }
    setLoading(true);
    setErrorKind(null);
    setErrorMsg('');
    try {
      const res = await api.getSales({ limit: FETCH_LIMIT });
      if (res?.error) throw new Error(res.error);
      setSales(Array.isArray(res.data) ? res.data : []);
      setTotalCount(Number(res.total) || 0);
      setReadOnly(false);
    } catch (err) {
      const msg = err?.message || 'Error al cargar ventas';
      // GAS sin los endpoints nuevos (routing o función ausente):
      //   "Acción GET desconocida: getSales" | "getSales_ is not defined"
      // → respaldo de SOLO LECTURA con getSalesReport (que sí existe en el GAS actual).
      if (/desconocida|not defined|no definid/i.test(msg)) {
        try {
          const rep = await api.getSalesReport();
          if (rep?.error) throw new Error(rep.error);
          const list = Array.isArray(rep.sales) ? rep.sales : [];
          setSales(list);
          setTotalCount(list.length);
          setReadOnly(true);
        } catch {
          setErrorKind('gas');
        }
      } else {
        setErrorKind('other');
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = useCallback((val) => setSearchQuery(val), []);

  // Filtro en cliente por cliente / id / método / notas
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(s =>
      String(s.Cliente     || '').toLowerCase().includes(q) ||
      String(s.ID_Venta    || '').toLowerCase().includes(q) ||
      String(s.Metodo_Pago || '').toLowerCase().includes(q) ||
      String(s.Notas       || '').toLowerCase().includes(q)
    );
  }, [sales, searchQuery]);

  // Actualiza la lista tras editar/eliminar sin recargar todo
  const handleSaved = (updated) => {
    setSales(prev => prev.map(s => (s.ID_Venta === updated.ID_Venta ? { ...s, ...updated } : s)));
    setEditSale(null);
  };
  const handleDeleted = (id) => {
    setSales(prev => prev.filter(s => s.ID_Venta !== id));
    setTotalCount(n => Math.max(0, n - 1));
    setEditSale(null);
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Ventas</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {total > 0
              ? <>{total.toLocaleString('es-MX')} registradas · mostrando {Math.min(sales.length, total).toLocaleString('es-MX')}</>
              : 'Historial de ventas'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading || !state.isOnline}
          title="Actualizar"
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200
                     rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50
                     transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Aviso: modo solo lectura (Code.gs sin endpoints de edición) */}
      {readOnly && sales.length > 0 && !errorKind && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-snug">
            <span className="font-semibold">Modo solo lectura.</span> Puedes ver las ventas, pero para
            editar o eliminar hay que actualizar el <span className="font-mono">Code.gs</span> en Google
            Apps Script (redeploy). Las notas aparecerán una vez actualizado.
          </p>
        </div>
      )}

      {/* Resumen (solo con datos) */}
      {sales.length > 0 && !errorKind && (
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400">Ventas mostradas</p>
          <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">
            {filtered.length.toLocaleString('es-MX')}
          </p>
        </div>
      )}

      {/* Buscador (solo con datos) */}
      {sales.length > 0 && !errorKind && (
        <SearchInput
          onSearch={handleSearch}
          onClose={() => handleSearch('')}
          placeholder="Buscar por cliente, método, ID o nota…"
          inputClassName="bg-white border border-gray-200 shadow-sm"
        />
      )}

      {/* ── Estados ─────────────────────────────────────────────────────── */}

      {/* Offline */}
      {errorKind === 'offline' && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center">
          <WifiOff size={32} className="mx-auto text-amber-500 mb-2" />
          <p className="text-sm font-medium text-amber-800">Sin conexión</p>
          <p className="text-xs text-amber-600 mt-1">
            El monitor de ventas necesita internet para leer la hoja de Google Sheets.
          </p>
        </div>
      )}

      {/* Code.gs desactualizado */}
      {errorKind === 'gas' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Falta actualizar Google Apps Script</p>
              <p className="text-xs text-blue-600 mt-1 leading-snug">
                Esta sección usa funciones nuevas del servidor (<span className="font-mono">getSales</span>,
                {' '}<span className="font-mono">updateSale</span>). Copia el <span className="font-semibold">Code.gs</span>{' '}
                actualizado al editor de Apps Script y vuelve a desplegar (Implementar → Administrar
                implementaciones → Nueva versión). Luego pulsa Actualizar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Otro error */}
      {errorKind === 'other' && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
          <AlertTriangle size={24} className="mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button onClick={load} className="mt-3 text-xs font-semibold text-red-600 underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Cargando (primera carga) */}
      {loading && sales.length === 0 && !errorKind && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Vacío */}
      {!loading && !errorKind && sales.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm border border-gray-100">
          <Receipt size={40} strokeWidth={1} className="mx-auto mb-3" />
          <p className="text-sm">No hay ventas registradas todavía</p>
        </div>
      )}

      {/* Sin resultados de búsqueda */}
      {!errorKind && sales.length > 0 && filtered.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">
          Sin resultados para "{searchQuery}"
        </p>
      )}

      {/* ── Lista de ventas ─────────────────────────────────────────────── */}
      {!errorKind && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(sale => (
            <button
              key={sale.ID_Venta}
              onClick={() => setEditSale(sale)}
              className="w-full text-left bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100
                         hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
                      <Clock size={11} className="text-gray-400" />
                      {fmtDateTime(sale.Fecha)}
                    </span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium
                      ${METHOD_STYLE[sale.Metodo_Pago] || 'bg-gray-100 text-gray-600'}`}>
                      {sale.Metodo_Pago || 'Efectivo'}
                    </span>
                  </div>
                  {sale.Cliente && (
                    <p className="flex items-center gap-1 text-xs text-gray-500 mt-1 truncate">
                      <User size={11} className="text-gray-400 flex-shrink-0" />
                      {sale.Cliente}
                    </p>
                  )}
                  {sale.Productos && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2 whitespace-pre-line leading-snug">
                      {String(sale.Productos)}
                    </p>
                  )}
                  {sale.Notas && (
                    <p className="text-xs text-gray-400 italic mt-1 truncate">“{sale.Notas}”</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-gray-900">
                    ${Number(sale.Total || 0).toLocaleString('es-MX')}
                  </p>
                  <p className="text-[11px] text-orange-500 font-medium mt-0.5">{readOnly ? 'Ver' : 'Editar'}</p>
                </div>
              </div>
            </button>
          ))}

          {total > sales.length && (
            <p className="text-center text-xs text-gray-400 pt-2 pb-1">
              Mostrando las {sales.length.toLocaleString('es-MX')} más recientes de {total.toLocaleString('es-MX')}
            </p>
          )}
        </div>
      )}

      {/* Modal de edición */}
      {editSale && (
        <SaleEditModal
          sale={editSale}
          onClose={() => setEditSale(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          notify={notify}
          isOnline={state.isOnline}
          canEdit={!readOnly}
        />
      )}
    </div>
  );
}
