const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'lumadlc.db'));

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  uid INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  hwid TEXT,
  subscription_until TEXT,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  used INTEGER DEFAULT 0,
  used_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(used_by) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS license_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_code TEXT UNIQUE NOT NULL,
  duration_days INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  used_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(used_by) REFERENCES users(uid)
);
`);

// Seed one admin account and a few invite codes if empty
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?,?,?,1)')
    .run('admin', 'admin@lumadlc.fun', hash);

  const seedCodes = ['LUMA-WELCOME-01', 'LUMA-WELCOME-02', 'LUMA-WELCOME-03'];
  const insertCode = db.prepare('INSERT INTO invite_codes (code) VALUES (?)');
  seedCodes.forEach(c => insertCode.run(c));
}

module.exports = db;
