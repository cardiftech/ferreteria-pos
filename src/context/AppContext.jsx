import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useCallback,
} from 'react';
import { syncInventory, shouldSync } from '../services/sync';

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
    notifyTimer.current = setTimeout(
      () => dispatch({ type: 'SET_NOTIFICATION', payload: null }),
      4000
    );
  }, []);

  const sync = useCallback(
    async (force = false) => {
      if (isSyncing.current || !navigator.onLine) return null;
      if (!force && !(await shouldSync())) return null;

      isSyncing.current = true;
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

      try {
        const result = await syncInventory((loaded, total) => {
          dispatch({ type: 'SET_SYNC_PROGRESS', payload: { loaded, total } });
        });
        dispatch({ type: 'SET_SYNC_PROGRESS', payload: null });
        dispatch({ type: 'SET_SYNC_STATUS',   payload: 'success' });
        dispatch({ type: 'SET_LAST_SYNC',     payload: result.timestamp });
        return result;
      } catch (err) {
        dispatch({ type: 'SET_SYNC_PROGRESS', payload: null });
        dispatch({ type: 'SET_SYNC_STATUS',   payload: 'error' });
        notify('Error al sincronizar inventario', 'error');
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

  return (
    <AppContext.Provider value={{ state, dispatch, notify, sync }}>
      {children}

      {/* Toast de notificación */}
      {state.notification && (
        <div
          className={[
            'fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999]',
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
