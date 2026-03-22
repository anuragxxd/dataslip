import { Database } from "bun:sqlite";
import { ConnectionConfig } from "../db/types";
import { ensureDataDir, getDatabasePath } from "../utils/app-paths";

let db: Database | null = null;
let dbPath: string | null = null;

function createDb(databasePath: string): Database {
  const nextDb = new Database(databasePath);
  nextDb.run("PRAGMA journal_mode=WAL");

  nextDb.run(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL DEFAULT 'localhost',
      port INTEGER NOT NULL DEFAULT 5432,
      database_name TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL DEFAULT '',
      ssl TEXT NOT NULL DEFAULT 'disable',
      color TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  nextDb.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  return nextDb;
}

function getDb(): Database {
  const nextDbPath = getDatabasePath();
  if (db && dbPath === nextDbPath) return db;

  if (db) {
    db.close();
  }

  ensureDataDir();
  db = createDb(nextDbPath);
  dbPath = nextDbPath;

  return db;
}

export function getStoragePath(): string {
  return getDatabasePath();
}

function rowToConfig(row: any): ConnectionConfig {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    database: row.database_name,
    username: row.username,
    password: row.password,
    ssl: row.ssl,
    color: row.color || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllConnections(): ConnectionConfig[] {
  const rows = getDb()
    .query("SELECT * FROM connections ORDER BY updated_at DESC")
    .all();
  return rows.map(rowToConfig);
}

export function getConnection(id: string): ConnectionConfig | null {
  const row = getDb()
    .query("SELECT * FROM connections WHERE id = ?")
    .get(id) as any;
  return row ? rowToConfig(row) : null;
}

export function saveConnection(config: ConnectionConfig): void {
  const d = getDb();
  d.run(
    `INSERT OR REPLACE INTO connections 
     (id, name, host, port, database_name, username, password, ssl, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      config.id,
      config.name,
      config.host,
      config.port,
      config.database,
      config.username,
      config.password,
      config.ssl,
      config.color || null,
      config.createdAt,
      config.updatedAt,
    ]
  );
}

export function deleteConnection(id: string): void {
  getDb().run("DELETE FROM connections WHERE id = ?", [id]);
}

// --- Settings persistence ---

export function getSetting(key: string): string | null {
  const row = getDb()
    .query("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | null;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, value]
  );
}

export function getJsonSetting<T>(key: string): T | null {
  const raw = getSetting(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJsonSetting(key: string, value: unknown): void {
  setSetting(key, JSON.stringify(value));
}

export function deleteSetting(key: string): void {
  getDb().run("DELETE FROM settings WHERE key = ?", [key]);
}

export function closeStorage(): void {
  if (db) {
    db.close();
    db = null;
  }
  dbPath = null;
}
