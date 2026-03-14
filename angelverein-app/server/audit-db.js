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
 * Audit-Log-Tabelle erstellen und Indizes anlegen.
 * Wird beim Serverstart aufgerufen.
 */
function initializeAuditDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      zeitstempel  TEXT    NOT NULL,
      benutzer_id  INTEGER,
      benutzername TEXT,
      aktion       TEXT    NOT NULL,
      entitaet     TEXT,
      entitaet_id  INTEGER,
      details      TEXT
    )
  `);

  // Indizes für schnelle Filterabfragen
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_zeitstempel ON audit_log (zeitstempel)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_aktion ON audit_log (aktion)`);

  console.log('✅ Audit-Datenbank initialisiert');
}

/**
 * Einen Audit-Eintrag schreiben.
 * @param {number|null} benutzerId - ID des Benutzers der die Aktion ausführte
 * @param {string|null} benutzername - Username zum Zeitpunkt der Aktion (kein FK!)
 * @param {string} aktion - Aktionscode, z.B. 'MITGLIED_ERSTELLT'
 * @param {string|null} entitaet - Betroffene Entität, z.B. 'mitglied'
 * @param {number|null} entitaetId - ID der betroffenen Entität
 * @param {object|null} details - Zusatzinfos (werden als JSON gespeichert)
 */
function logAktion(benutzerId, benutzername, aktion, entitaet, entitaetId, details) {
  try {
    db.prepare(`
      INSERT INTO audit_log (zeitstempel, benutzer_id, benutzername, aktion, entitaet, entitaet_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      benutzerId ?? null,
      benutzername ?? null,
      aktion,
      entitaet ?? null,
      entitaetId ?? null,
      details !== null && details !== undefined ? JSON.stringify(details) : null
    );
  } catch (err) {
    // Logging-Fehler dürfen nie die eigentliche Aktion blockieren
    console.error('Audit-Log Fehler:', err);
  }
}

/**
 * Audit-Einträge paginiert abrufen.
 * @param {object} opts
 * @param {string} [opts.von] - Startdatum ISO (z.B. "2026-01-01")
 * @param {string} [opts.bis] - Enddatum ISO (z.B. "2026-12-31")
 * @param {string} [opts.aktion] - Aktionstyp-Filter
 * @param {number} [opts.seite=1] - Seitennummer (ab 1)
 * @returns {{ eintraege: object[], gesamt: number, seite: number, seiten: number, proSeite: number }}
 */
function getAuditLog({ von, bis, aktion, seite = 1 } = {}) {
  const proSeite = 50;
  const offset = (seite - 1) * proSeite;

  // WHERE-Bedingungen dynamisch aufbauen
  const bedingungen = [];
  const params = [];

  if (von) {
    bedingungen.push('zeitstempel >= ?');
    params.push(von);
  }
  if (bis) {
    // bis-Datum bis Tagesende einschließen
    bedingungen.push('zeitstempel < ?');
    params.push(bis + 'T23:59:59.999Z');
  }
  if (aktion) {
    bedingungen.push('aktion = ?');
    params.push(aktion);
  }

  const where = bedingungen.length > 0 ? `WHERE ${bedingungen.join(' AND ')}` : '';

  const gesamt = db.prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`).get(...params).count;

  const eintraege = db.prepare(`
    SELECT * FROM audit_log ${where}
    ORDER BY zeitstempel DESC
    LIMIT ? OFFSET ?
  `).all(...params, proSeite, offset);

  // details-JSON parsen für die Anzeige
  for (const eintrag of eintraege) {
    if (eintrag.details) {
      try {
        eintrag.details = JSON.parse(eintrag.details);
      } catch {
        // Bleibt als String wenn JSON-Parse scheitert
      }
    }
  }

  const seiten = Math.max(1, Math.ceil(gesamt / proSeite));

  return { eintraege, gesamt, seite, seiten, proSeite };
}

/**
 * Alle vorkommenden Aktionstypen abrufen (für Dropdown-Filter im Frontend).
 * @returns {string[]}
 */
function getAuditAktionen() {
  const rows = db.prepare('SELECT DISTINCT aktion FROM audit_log ORDER BY aktion').all();
  return rows.map(r => r.aktion);
}

/**
 * Einträge älter als 12 Monate löschen (DSGVO-Aufbewahrungsfrist).
 * @returns {number} Anzahl gelöschter Einträge
 */
function bereinigteEintraege() {
  const grenze = new Date();
  grenze.setMonth(grenze.getMonth() - 12);
  const result = db.prepare('DELETE FROM audit_log WHERE zeitstempel < ?').run(grenze.toISOString());
  return result.changes;
}

module.exports = {
  initializeAuditDatabase,
  logAktion,
  getAuditLog,
  getAuditAktionen,
  bereinigteEintraege
};
