// Einmalige Migration: Unverschlüsselte SQLite-DB → SQLCipher (AES-256)
//
// Aufruf auf dem Server (im Docker-Container):
//   DB_PASSWORD=xxx node server/scripts/migrate-to-encrypted.js
//
// WICHTIG: Nur EINMALIG ausführen, BEVOR der Server mit Verschlüsselung gestartet wird!
// Danach ist die DB verschlüsselt und der Server braucht immer DB_PASSWORD zum Starten.

const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');

// Passwort aus Umgebungsvariable lesen
const password = process.env.DB_PASSWORD;
if (!password) {
  console.error('Fehler: DB_PASSWORD Umgebungsvariable muss gesetzt sein.');
  console.error('Beispiel: DB_PASSWORD=meinpasswort node server/scripts/migrate-to-encrypted.js');
  process.exit(1);
}

const dbPath = path.join(__dirname, '..', '..', 'data', 'angelverein.db');
const encPath = dbPath + '.encrypted';

// Prüfen ob die Quelldatei existiert
if (!fs.existsSync(dbPath)) {
  console.error('Fehler: Datenbankdatei nicht gefunden:', dbPath);
  process.exit(1);
}

// Prüfen ob die DB schon verschlüsselt ist (Datei beginnt mit "SQLite format 3")
const header = Buffer.alloc(16);
const fd = fs.openSync(dbPath, 'r');
fs.readSync(fd, header, 0, 16, 0);
fs.closeSync(fd);
if (!header.toString('utf8', 0, 6).startsWith('SQLite')) {
  console.error('Fehler: Die Datenbank scheint bereits verschlüsselt zu sein.');
  console.error('Migration abgebrochen – kein erneutes Ausführen nötig.');
  process.exit(1);
}

console.log('Starte Migration der Datenbank zu SQLCipher...');

// Bestehende unverschlüsselte DB öffnen (ohne Passwort)
const db = new Database(dbPath);

// Verschlüsselte Kopie der DB erstellen (SQLCipher-Funktion sqlcipher_export)
// Das Passwort wird dabei direkt in die neue Datei eingebettet
db.exec(`ATTACH DATABASE '${encPath}' AS encrypted KEY '${password}'`);
db.exec(`SELECT sqlcipher_export('encrypted')`);
db.exec(`DETACH DATABASE encrypted`);
db.close();

// Originaldatei als Backup umbenennen, verschlüsselte Version als neue DB einsetzen
fs.renameSync(dbPath, dbPath + '.backup_unencrypted');
fs.renameSync(encPath, dbPath);

// WAL-Begleitdateien löschen (werden beim nächsten Serverstart neu erstellt)
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
console.log('  → Nach erfolgreichem Test des Servers das Backup manuell löschen!');
