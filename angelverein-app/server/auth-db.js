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
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Auth-Datenbank initialisiert');
}

/**
 * Benutzer nach Username abrufen
 */
function getUser(username) {
  return db.prepare('SELECT * FROM benutzer WHERE username = ?').get(username);
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

module.exports = {
  initializeAuthDatabase,
  getUser,
  createUser,
  updateUserPassword,
  countUsers
};
