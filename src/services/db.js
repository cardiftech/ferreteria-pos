import Dexie from 'dexie';

const db = new Dexie('FerreteriaDB');

// v1 — schema original (Codigo_Barras)
db.version(1).stores({
  inventory:    'Codigo_Barras, Categoria, Stock_Actual',
  syncMeta:     'key',
  pendingSales: '++id, timestamp, synced',
});

// v2 — nuevo schema: Bar_code como PK + tabla clients
db.version(2).stores({
  inventory:    'Bar_code, Marca, Stock_Actual',
  clients:      'ID_Cliente, Nombre',
  syncMeta:     'key',
  pendingSales: '++id, timestamp, synced',
});

export default db;
