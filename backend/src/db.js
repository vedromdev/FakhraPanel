import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/azadi.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  flag TEXT DEFAULT '🏳️',
  country TEXT,
  agent_id TEXT UNIQUE,
  public_host TEXT,
  capability TEXT DEFAULT 'vps',
  port_base INTEGER DEFAULT 40000,
  sni TEXT,
  cert_file TEXT,
  key_file TEXT,
  reality_key TEXT,
  sid TEXT,
  pbk TEXT,
  wg_pub TEXT,
  wg_priv TEXT,
  wg_ip TEXT,
  wg_port INTEGER DEFAULT 51820,
  bandwidth_up TEXT DEFAULT '100mbps',
  bandwidth_down TEXT DEFAULT '200mbps',
  access_log TEXT DEFAULT '/var/log/azadi/xray-access.log',
  status TEXT NOT NULL DEFAULT 'offline',
  last_seen INTEGER,
  version TEXT,
  info TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  uuid TEXT NOT NULL,
  sub_token TEXT UNIQUE NOT NULL,
  data_limit_gb REAL DEFAULT 0,
  used_bytes INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS assignments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, node_id)
);
CREATE TABLE IF NOT EXISTS traffic (
  node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bytes INTEGER NOT NULL DEFAULT 0,
  ts INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS user_online (
  user_id INTEGER NOT NULL,
  node_id INTEGER NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, node_id)
);
`);

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}
export default db;