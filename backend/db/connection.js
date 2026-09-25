// backend/db/connection.js
// Conexión a SQLite con better-sqlite3 y modo WAL para concurrencia local.

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'don_penolinni.db');

/** Crea (o abre) la base de datos y aplica PRAGMAs de concurrencia */
function createConnection() {
  const db = new Database(DB_PATH);

  // ── PRAGMAs críticos para concurrencia en red local ──
  db.pragma('journal_mode = WAL');      // Evita "database is locked"
  db.pragma('foreign_keys = ON');       // Integridad referencial
  db.pragma('busy_timeout = 5000');     // Espera 5s antes de fallar por bloqueo

  return db;
}

/** Ejecuta el schema.sql para crear las tablas si no existen */
function initializeSchema(db) {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('✅ Esquema de BD inicializado correctamente');
}

// ── Instancia singleton ──────────────────────────────────────
const db = createConnection();
runMigrations(db);
initializeSchema(db);

// Cerrar la BD limpiamente al salir del proceso
process.on('exit', () => db.close());
process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });

export default db;
