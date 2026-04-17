import { useApp } from '../context/AppContext';

// Thin wrapper — el estado y la función viven en AppContext (singleton)
export function useSync() {
  const { sync, state } = useApp();
  return {
    sync,
    syncStatus: state.syncStatus,
    lastSync: state.lastSync,
  };
}
