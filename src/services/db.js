import Dexie from 'dexie';

const db = new Dexie('FerreteriaDB');

db.version(1).stores({
  // Codigo_Barras es la PK; los demás son índices para queries rápidas
  inventory: 'Codigo_Barras, Categoria, Stock_Actual',
  syncMeta: 'key',
  pendingSales: '++id, timestamp, synced',
});

export default db;
