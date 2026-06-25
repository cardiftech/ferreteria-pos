import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useCallback,
} from 'react';
import {
  syncInventory, syncClients, syncPendingClients,
  shouldSync, getLastSyncTime,
} from '../services/sync';

const VISIBILITY_SYNC_MS = 30 * 60 * 1000; // re-sync si vuelven tras 30+ min ausente

const AppContext = createContext(null);

const initialState = {
  isOnline:     navigator.onLine,
  syncStatus:   'idle',   // 'idle' | 'syncing' | 'success' | 'error'
  syncProgress: null,     // { loaded: number, total: number } | null
  lastSync:     null,
  notification: null,
};

function reducer(state, action) {
  switch (action.type) {
    // Bail-out si el valor no cambia: el ping de conectividad despacha SET_ONLINE
    // cada 5 s. Sin esta guarda, devolver un objeto nuevo cada vez re-renderizaría
    // TODA la app (POS, Navbar, listas) cada 5 s aunque el estado sea el mismo.
    case 'SET_ONLINE':
      return state.isOnline === action.payload
        ? state
        : { ...state, isOnline: action.payload };
    case 'SET_SYNC_STATUS':   return { ...state, syncStatus:   action.payload };
    case 'SET_SYNC_PROGRESS': return { ...state, syncProgress: action.payload };
    case 'SET_LAST_SYNC':     return { ...state, lastSync:     action.payload };
    case 'SET_NOTIFICATION':  return { ...state, notification: action.payload };
    default:                 return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isSyncing = useRef(false);
  const notifyTimer = useRef(null);
  const prevOnline = useRef(navigator.onLine);

  // Listener online/offline
  useEffect(() => {
    const setOnline  = () => dispatch({ type: 'SET_ONLINE', payload: true });
    const setOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });
    window.addEventListener('online',  setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online',  setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  const notify = useCallback((message, type = 'info') => {
    if (notifyTimer.current) clearTimeout(notifyTimer.current);
    dispatch({ type: 'SET_NOTIFICATION', payload: { message, type } });
    // Duración dinámica: mínimo 3 s, ~60 ms por carácter, máximo 8 s.
    // Evita que mensajes largos (p.ej. "37 omitidos (sin código de barras)")
    // desaparezcan antes de que el usuario pueda leerlos.
    const duration = Math.min(Math.max(3_000, message.length * 60), 8_000);
    notifyTimer.current = setTimeout(
      () => dispatch({ type: 'SET_NOTIFICATION', payload: null }),
      duration
    );
  }, []);

  const sync = useCallback(
    async (force = false) => {
      if (isSyncing.current || !navigator.onLine) return null;
      if (!force && !(await shouldSync())) return null;

      isSyncing.current = true;
      dispatch({ type: 'SET_SYNC_STATUS',   payload: 'syncing' });
      // Muestra el contador inmediatamente, antes de que llegue el primer batch
      dispatch({ type: 'SET_SYNC_PROGRESS', payload: { loaded: 0, total: null } });

      try {
        const result = await syncInventory((loaded, total) => {
          dispatch({ type: 'SET_SYNC_PROGRESS', payload: { loaded, total } });
        });
        dispatch({ type: 'SET_SYNC_PROGRESS', payload: null });
        dispatch({ type: 'SET_SYNC_STATUS',   payload: 'success' });
        dispatch({ type: 'SET_LAST_SYNC',     payload: result.timestamp });

        // Orden importa: subir LOCAL-* primero para que tengan ID real antes de
        // que syncClients traiga la lista fresca de Sheets con esos mismos IDs.
        await syncPendingClients().catch(err => console.warn('[sync] pending clients:', err));
        await syncClients().catch(err => console.warn('[sync] clients:', err));

        // Notifica a useInventory que hay datos nuevos (cubre casos donde liveQuery no dispara)
        window.dispatchEvent(new CustomEvent('ferrepos:synced'));
        return result;
      } catch (err) {
        dispatch({ type: 'SET_SYNC_PROGRESS', payload: null });
        dispatch({ type: 'SET_SYNC_STATUS',   payload: 'error' });
        console.error('[Sync] Error:', err);
        notify('Error sync: ' + (err?.message || 'desconocido'), 'error');
        return null;
      } finally {
        isSyncing.current = false;
      }
    },
    [notify]
  );

  // Sync inicial al montar
  useEffect(() => { sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync al recuperar conexión
  useEffect(() => {
    const wasOffline = !prevOnline.current;
    prevOnline.current = state.isOnline;
    if (state.isOnline && wasOffline) sync(true);
  }, [state.isOnline, sync]);

  // Sync al volver a la PWA (pestaña/app vuelve a ser visible)
  // Solo si pasaron más de 30 min desde la última sync
  useEffect(() => {
    const onVisible = async () => {
      if (document.hidden) return;
      if (!navigator.onLine) return;
      const last = await getLastSyncTime();
      if (!last) { sync(); return; }
      if (Date.now() - new Date(last).getTime() > VISIBILITY_SYNC_MS) sync(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sync]);

  // Verificación activa de conectividad real cada 5 s.
  // navigator.onLine NO detecta "WiFi conectado sin internet" — el navegador
  // solo mira si existe una interfaz de red activa, no si hay salida real.
  //
  // Se usa un HEAD a gstatic.com/generate_204 (endpoint de Google para checks
  // de conectividad, idéntico al que usa Android/ChromeOS):
  //   • Responde en < 100 ms cuando hay internet → Online confirmado.
  //   • Falla con TypeError INMEDIATAMENTE cuando no hay internet real →
  //     incluso con WiFi "conectado" al router sin salida a internet.
  //   • AbortError (3 s de timeout) → resultado incierto, no cambia el indicador.
  // Esto soluciona el problema de GAS: su cold-start causa AbortError aunque
  // haya internet, lo que impedía detectar correctamente el estado Online.
  useEffect(() => {
    let cancelled = false;
    let timer;

    const verify = async () => {
      if (cancelled) return;
      if (!navigator.onLine) {
        // El navegador ya sabe que no hay interfaz de red
        if (!cancelled) dispatch({ type: 'SET_ONLINE', payload: false });
        timer = setTimeout(verify, 5_000);
        return;
      }
      const ctrl  = new AbortController();
      const abort = setTimeout(() => ctrl.abort(), 3_000);
      try {
        await fetch('https://www.gstatic.com/generate_204', {
          method: 'HEAD',
          mode:   'no-cors',   // evita errores CORS; respuesta opaca confirma conectividad
          cache:  'no-store',
          signal: ctrl.signal,
        });
        if (!cancelled) dispatch({ type: 'SET_ONLINE', payload: true });
      } catch (err) {
        // TypeError = sin internet real (fallo inmediato de red)
        // AbortError = timeout de 3 s (resultado incierto, no cambiar estado)
        if (err.name !== 'AbortError' && !cancelled) {
          dispatch({ type: 'SET_ONLINE', payload: false });
        }
      } finally {
        clearTimeout(abort);
      }
      if (!cancelled) timer = setTimeout(verify, 5_000);
    };

    timer = setTimeout(verify, 1_000); // primer check 1 s después del montaje
    return () => { cancelled = true; clearTimeout(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ state, dispatch, notify, sync }}>
      {children}

      {/* Toast de notificación */}
      {state.notification && (
        <div
          className={[
            'fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999]',
            'px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium',
            'max-w-xs w-max text-center',
            state.notification.type === 'success' ? 'bg-green-600' :
            state.notification.type === 'error'   ? 'bg-red-600'   :
            state.notification.type === 'warning' ? 'bg-orange-500': 'bg-gray-800',
          ].join(' ')}
        >
          {state.notification.message}
        </div>
      )}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
