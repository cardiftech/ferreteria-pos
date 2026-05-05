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
    case 'SET_ONLINE':       return { ...state, isOnline: action.payload };
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

        // Sube clientes guardados offline y luego refresca la lista desde Sheets.
        // El orden importa: primero subir los LOCAL-* para que aparezcan en la
        // respuesta fresca de Sheets con su ID real.
        await syncPendingClients().catch(() => {});
        await syncClients().catch(() => {});

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
