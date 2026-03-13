const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'angelverein.db');

// Sicherstellen, dass der data-Ordner existiert
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

/**
 * Benutzer-Tabelle erstellen
 */
function initializeAuthDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS benutzer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rolle TEXT NOT NULL DEFAULT 'viewer',
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabelle für benutzerspezifische Spalten-Einstellungen
  db.exec(`
    CREATE TABLE IF NOT EXISTS benutzer_spalten (
      user_id INTEGER NOT NULL,
      spalten_key TEXT NOT NULL,
      sichtbar INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, spalten_key)
    )
  `);

  // Prüfen ob Rolle-Spalte existiert (für Migration alter Versionen)
  const cols = db.prepare("PRAGMA table_info(benutzer)").all().map(c => c.name);
  if (!cols.includes('rolle')) {
    db.exec("ALTER TABLE benutzer ADD COLUMN rolle TEXT NOT NULL DEFAULT 'viewer'");
    console.log('🔧 Rolle-Spalte in benutzer-Tabelle hinzugefügt');
  }

  // Wenn bereits genau ein Benutzer existiert und noch keine Admin
  const users = db.prepare('SELECT id, rolle FROM benutzer').all();
  if (users.length === 1 && users[0].rolle !== 'admin') {
    db.prepare('UPDATE benutzer SET rolle = ? WHERE id = ?').run('admin', users[0].id);
    console.log('🔧 Bestehender Einzelbenutzer als Admin markiert');
  }

  console.log('✅ Auth-Datenbank initialisiert');
}

/**
 * Benutzer nach Username abrufen
 */
function getUser(username) {
  return db.prepare('SELECT * FROM benutzer WHERE username = ?').get(username);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM benutzer WHERE id = ?').get(id);
}

/**
 * Neuen Benutzer erstellen
 */
function createUser(username, passwordHash) {
  const result = db.prepare(
    'INSERT INTO benutzer (username, password_hash) VALUES (?, ?)'
  ).run(username, passwordHash);
  return { id: result.lastInsertRowid, username };
}

/**
 * Passwort aktualisieren
 */
function updateUserPassword(id, passwordHash) {
  db.prepare('UPDATE benutzer SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

/**
 * Anzahl Benutzer
 */
function countUsers() {
  return db.prepare('SELECT COUNT(*) as count FROM benutzer').get().count;
}

function getAllUsers() {
  return db.prepare('SELECT id, username, rolle, erstellt_am FROM benutzer ORDER BY username').all();
}

function createUserWithRole(username, passwordHash, rolle = 'viewer') {
  const result = db.prepare(
    'INSERT INTO benutzer (username, password_hash, rolle) VALUES (?, ?, ?)'
  ).run(username, passwordHash, rolle);
  return { id: result.lastInsertRowid, username, rolle };
}

function updateUserRole(id, rolle) {
  db.prepare('UPDATE benutzer SET rolle = ? WHERE id = ?').run(rolle, id);
}

function deleteUser(id) {
  return db.prepare('DELETE FROM benutzer WHERE id = ?').run(id);
}

/**
 * Alle Spalten-Einstellungen eines Benutzers abrufen
 * Gibt ein Objekt zurück: { "nachname": true, "vorname": false, ... }
 */
function getUserSpaltenSichtbar(userId) {
  const rows = db.prepare('SELECT spalten_key, sichtbar FROM benutzer_spalten WHERE user_id = ?').all(userId);
  const result = {};
  for (const row of rows) {
    result[row.spalten_key] = row.sichtbar === 1;
  }
  return result;
}

/**
 * Eine Spalten-Einstellung für einen Benutzer speichern (upsert)
 */
function setUserSpaltenSichtbar(userId, spaltenKey, sichtbar) {
  db.prepare(`
    INSERT INTO benutzer_spalten (user_id, spalten_key, sichtbar)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, spalten_key) DO UPDATE SET sichtbar = excluded.sichtbar
  `).run(userId, spaltenKey, sichtbar ? 1 : 0);
}

module.exports = {
  initializeAuthDatabase,
  getUser,
  getUserById,
  createUser,
  createUserWithRole,
  updateUserPassword,
  updateUserRole,
  deleteUser,
  getAllUsers,
  countUsers,
  getUserSpaltenSichtbar,
  setUserSpaltenSichtbar
};
