// Einmalige Migration: Unverschlüsselte SQLite-DB → SQLCipher (AES-256)
//
// Aufruf auf dem Server (im Docker-Container):
//   DB_PASSWORD=xxx node server/scripts/migrate-to-encrypted.js
//
// WICHTIG: Nur EINMALIG ausführen, BEVOR der Server mit Verschlüsselung gestartet wird!
// Danach ist die DB verschlüsselt und der Server braucht immer DB_PASSWORD zum Starten.

// Einmalige Migration: Unverschlüsselte SQLite-DB → verschlüsselte DB
const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');

const password = process.env.DB_PASSWORD;
if (!password) {
  console.error('Fehler: DB_PASSWORD Umgebungsvariable muss gesetzt sein.');
  process.exit(1);
}

const dbPath = path.join(__dirname, '..', '..', 'data', 'angelverein.db');

if (!fs.existsSync(dbPath)) {
  console.error('Fehler: Datenbankdatei nicht gefunden:', dbPath);
  process.exit(1);
}

// Prüfen ob die DB schon verschlüsselt ist
const header = Buffer.alloc(16);
const fd = fs.openSync(dbPath, 'r');
fs.readSync(fd, header, 0, 16, 0);
fs.closeSync(fd);

if (!header.toString('utf8', 0, 6).startsWith('SQLite')) {
  console.error('Fehler: Die Datenbank scheint bereits verschlüsselt zu sein.');
  process.exit(1);
}

console.log('Starte Migration der Datenbank zu SQLCipher...');

// Backup erstellen
fs.copyFileSync(dbPath, dbPath + '.backup_unencrypted');
console.log('Backup erstellt:', dbPath + '.backup_unencrypted');

// DB öffnen und direkt verschlüsseln mit rekey
const db = new Database(dbPath);
db.pragma(`rekey='${password}'`);
db.close();

// Prüfen ob Verschlüsselung funktioniert hat
const db2 = new Database(dbPath, { readonly: true });
try {
  db2.pragma(`key='${password}'`);
  db2.prepare('SELECT count(*) FROM sqlite_master').get();
  db2.close();
} catch (e) {
  console.error('Fehler: Verschlüsselung konnte nicht verifiziert werden:', e.message);
  process.exit(1);
}

// WAL-Dateien löschen
for (const suffix of ['-wal', '-shm']) {
  const f = dbPath + suffix;
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log('WAL-Datei gelöscht:', f);
  }
}

console.log('');
console.log('✓ Migration erfolgreich abgeschlossen!');
console.log('  Backup der alten DB: angelverein.db.backup_unencrypted');
console.log('  → Nach erfolgreichem Test das Backup manuell löschen!');
