import Dexie from 'dexie';

const db = new Dexie('FerreteriaDB');

/**
 * Dexie NO permite cambiar la primary key de una tabla existente.
 * Solución: eliminar el object store en v2 (null) y recrearlo en v3 con la nueva PK.
 *
 * v1 → v2 : inventory=null   → elimina el store (borra datos v1 con PK Codigo_Barras)
 * v2 → v3 : inventory creado de cero con PK Bar_code + tabla clients
 *            syncMeta.clear() fuerza re-sync para llenar el nuevo store
 */

// v1 — schema original (Codigo_Barras como PK)
db.version(1).stores({
  inventory:    'Codigo_Barras, Categoria, Stock_Actual',
  syncMeta:     'key',
  pendingSales: '++id, timestamp, synced',
});

// v2 — elimina inventory para poder recrearlo con otra PK en v3
db.version(2).stores({
  inventory:    null,   // DROP — Dexie borra el object store completamente
  syncMeta:     'key',
  pendingSales: '++id, timestamp, synced',
});

// v3 — crea inventory nuevo con Bar_code como PK + agrega clients
db.version(3).stores({
  inventory:    'Bar_code, Marca, Stock_Actual',
  clients:      'ID_Cliente, Nombre',
  syncMeta:     'key',
  pendingSales: '++id, timestamp, synced',
}).upgrade(tx => tx.table('syncMeta').clear()); // fuerza re-sync al abrir

// v4 — renombra índice Marca → PROVEEDOR (columna renombrada en Google Sheets)
db.version(4).stores({
  inventory:    'Bar_code, PROVEEDOR, Stock_Actual',
  clients:      'ID_Cliente, Nombre',
  syncMeta:     'key',
  pendingSales: '++id, timestamp, synced',
});

// v5 — agrega tabla de historial de restock (local, no sincroniza con el servidor)
db.version(5).stores({
  inventory:      'Bar_code, PROVEEDOR, Stock_Actual',
  clients:        'ID_Cliente, Nombre',
  syncMeta:       'key',
  pendingSales:   '++id, timestamp, synced',
  restockHistory: '++id, Bar_code, date',
});

export default db;
