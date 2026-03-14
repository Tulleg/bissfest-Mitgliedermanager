const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'));

const dbPath = path.join(__dirname, '..', 'data', 'angelverein.db');

// Sicherstellen, dass der data-Ordner existiert
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// WAL-Modus für bessere Performance
db.pragma('journal_mode = WAL');

// Berechnet das Alter aus einem Geburtsdatum (YYYY-MM-DD).
// Gibt null zurück wenn kein oder ungültiges Datum übergeben wird.
// Das Alter wird nicht in der DB gespeichert, sondern bei jeder Abfrage frisch berechnet,
// damit es immer aktuell ist – auch wenn kein Update am Mitglied gemacht wurde.
function berechneAlter(geburtsdatum) {
  if (!geburtsdatum) return null;
  const geb = new Date(geburtsdatum);
  if (isNaN(geb.getTime())) return null;
  const heute = new Date();
  let alter = heute.getFullYear() - geb.getFullYear();
  // Prüfen ob der Geburtstag dieses Jahr noch nicht war – dann ein Jahr abziehen
  const geburtstagDiesesJahr = new Date(heute.getFullYear(), geb.getMonth(), geb.getDate());
  if (heute < geburtstagDiesesJahr) alter--;
  return alter;
}

// Berechnet die Mitgliedsdauer in Jahren aus dem Eintrittsdatum (av).
// Gibt null zurück wenn kein oder ungültiges Datum übergeben wird.
// Funktioniert analog zu berechneAlter() – berücksichtigt ob das Jubiläum schon war.
function berechneMitgliedsdauer(av) {
  if (!av) return null;
  const eintrittsDatum = new Date(av);
  if (isNaN(eintrittsDatum.getTime())) return null;
  const heute = new Date();
  let jahre = heute.getFullYear() - eintrittsDatum.getFullYear();
  // Prüfen ob das Jubiläum dieses Jahr noch nicht war – dann ein Jahr abziehen
  const jubilaeum = new Date(heute.getFullYear(), eintrittsDatum.getMonth(), eintrittsDatum.getDate());
  if (heute < jubilaeum) jahre--;
  return jahre;
}

// Hängt das berechnete Alter und die Mitgliedsdauer an ein Mitglied-Objekt an.
// DB-Werte in "alter" und "mitgliedsdauer" werden überschrieben (nicht in DB gespeichert).
function mitAlterAnreichern(member) {
  if (!member) return member;
  return {
    ...member,
    alter: berechneAlter(member.geburtsdatum),
    mitgliedsdauer: berechneMitgliedsdauer(member.av)
  };
}

/**
 * Erstellt oder aktualisiert die Mitglieder-Tabelle basierend auf der config.json
 */
function initializeDatabase() {
  const spalten = config.spalten;
  
  // Prüfen ob Tabelle existiert
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='mitglieder'"
  ).get();

  if (!tableExists) {
    // Tabelle neu erstellen
    const columnDefs = spalten.map(col => {
      let sqlType = 'TEXT';
      if (col.type === 'boolean') sqlType = 'INTEGER';
      if (col.type === 'number') sqlType = 'REAL';
      
      let def = `"${col.key}" ${sqlType}`;
      if (col.required) def += ' NOT NULL';
      return def;
    });

    const createSQL = `
      CREATE TABLE mitglieder (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columnDefs.join(',\n        ')},
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    db.exec(createSQL);
    console.log('✅ Tabelle "mitglieder" erstellt');
  } else {
    // Prüfen ob neue Spalten hinzugefügt werden müssen
    const existingColumns = db.prepare("PRAGMA table_info(mitglieder)").all();
    const existingColumnNames = existingColumns.map(c => c.name);

    for (const col of spalten) {
      if (!existingColumnNames.includes(col.key)) {
        let sqlType = 'TEXT';
        if (col.type === 'boolean') sqlType = 'INTEGER';
        if (col.type === 'number') sqlType = 'REAL';

        db.exec(`ALTER TABLE mitglieder ADD COLUMN "${col.key}" ${sqlType}`);
        console.log(`✅ Spalte "${col.key}" hinzugefügt`);
      }
    }

    // Prüfe ob veraltete NOT NULL Spalten existieren, die nicht mehr in der config sind.
    // Diese blockieren das Anlegen neuer Mitglieder (INSERT schlägt fehl).
    const configKeys = spalten.map(s => s.key);
    const systemColumns = ['id', 'erstellt_am', 'aktualisiert_am'];
    const legacyNotNullColumns = existingColumns.filter(col =>
      !configKeys.includes(col.name) &&
      !systemColumns.includes(col.name) &&
      col.notnull === 1
    );

    if (legacyNotNullColumns.length > 0) {
      console.log('⚠️ Veraltetes Schema gefunden (NOT NULL Spalten nicht in config):', legacyNotNullColumns.map(c => c.name));

      const memberCount = db.prepare('SELECT COUNT(*) as count FROM mitglieder').get().count;
      if (memberCount > 0) {
        // Daten sichern bevor die Tabelle neu erstellt wird
        db.exec('ALTER TABLE mitglieder RENAME TO mitglieder_backup');
        console.log('⚠️ Bestehende Daten in "mitglieder_backup" gesichert');
      } else {
        db.exec('DROP TABLE mitglieder');
      }

      // Tabelle mit aktuellem Schema aus der config neu erstellen
      const newColumnDefs = spalten.map(col => {
        let sqlType = 'TEXT';
        if (col.type === 'boolean') sqlType = 'INTEGER';
        if (col.type === 'number') sqlType = 'REAL';
        let def = `"${col.key}" ${sqlType}`;
        if (col.required) def += ' NOT NULL';
        return def;
      });
      db.exec(`
        CREATE TABLE mitglieder (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${newColumnDefs.join(',\n          ')},
          erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
          aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Tabelle "mitglieder" mit aktuellem Schema neu erstellt');
    }
  }

  // Export-Vorlagen Tabelle
  db.exec(`
    CREATE TABLE IF NOT EXISTS export_vorlagen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ueberschrift TEXT,
      felder TEXT NOT NULL,
      filter TEXT,
      zeige_anzahl INTEGER DEFAULT 1,
      zeige_datum INTEGER DEFAULT 1,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Vorlagen aus Config laden, falls Tabelle leer
  const vorlagenCount = db.prepare('SELECT COUNT(*) as count FROM export_vorlagen').get();
  if (vorlagenCount.count === 0 && config.exportVorlagen) {
    const insertVorlage = db.prepare(`
      INSERT INTO export_vorlagen (name, ueberschrift, felder, filter, zeige_anzahl, zeige_datum)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const vorlage of config.exportVorlagen) {
      insertVorlage.run(
        vorlage.name,
        vorlage.ueberschrift || '',
        JSON.stringify(vorlage.felder),
        JSON.stringify(vorlage.filter || {}),
        vorlage.zeigeAnzahl ? 1 : 0,
        vorlage.zeigeDatum ? 1 : 0
      );
    }
    console.log('✅ Export-Vorlagen aus Config geladen');
  }

  // Settings-Tabelle für App-Einstellungen (z.B. Spalten-Sichtbarkeit)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Spalten-Sichtbarkeit initialisieren (nur wenn noch kein Eintrag vorhanden)
  for (const col of spalten) {
    const exists = db.prepare('SELECT key FROM settings WHERE key = ?').get(`spalte_sichtbar_${col.key}`);
    if (!exists) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(`spalte_sichtbar_${col.key}`, '1');
    }
  }

  // Fisch-Tabellen
  initFischDatabase();

  // Terminplan-Tabellen
  initTerminDatabase();

  console.log('✅ Datenbank initialisiert');
}

/**
 * Baut WHERE-Bedingungen aus dem Filter-Objekt.
 * Unterstützt neues Format: { feld: { op: "enthält"|"gleich", wert: "X|Y" } }
 * Sowie altes Format:       { feld: "wert" } → Fallback auf "enthält"
 * Mit | können mehrere Werte für ODER getrennt werden (z.B. "J|E")
 */
function buildFilterConditions(filter) {
  const conditions = [];
  const params = [];

  for (const [key, config] of Object.entries(filter)) {
    // Altes Format (reiner String) → in neues Format umwandeln
    const op = typeof config === 'string' ? 'enthält' : (config.op || 'enthält');
    const wert = typeof config === 'string' ? config : config.wert;

    if (!wert || wert.trim() === '') continue;

    // | als ODER-Trenner parsen
    const teile = wert.split('|').map(t => t.trim()).filter(t => t !== '');
    if (teile.length === 0) continue;

    let orParts;
    if (op === 'gleich') {
      // Exakter Vergleich
      orParts = teile.map(() => `"${key}" = ?`);
      teile.forEach(t => params.push(t));
    } else {
      // "enthält" → Teilsuche mit LIKE
      orParts = teile.map(() => `"${key}" LIKE ?`);
      teile.forEach(t => params.push(`%${t}%`));
    }

    // Mehrere Teile → OR-Gruppe in Klammern, einzelner Teil → direkt
    conditions.push(teile.length > 1 ? `(${orParts.join(' OR ')})` : orParts[0]);
  }

  return { conditions, params };
}

/**
 * Alle Mitglieder abrufen mit optionalem Filter
 */
function getAllMembers(filter = {}) {
  let sql = 'SELECT * FROM mitglieder';
  const { conditions, params } = buildFilterConditions(filter);

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY nachname, vorname';
  return db.prepare(sql).all(...params).map(mitAlterAnreichern);
}

/**
 * Ein Mitglied nach ID abrufen
 */
function getMemberById(id) {
  return mitAlterAnreichern(db.prepare('SELECT * FROM mitglieder WHERE id = ?').get(id));
}

/**
 * Neues Mitglied anlegen
 */
function createMember(data) {
  const spalten = config.spalten;
  const keys = [];
  const placeholders = [];
  const values = [];

  for (const col of spalten) {
    // Readonly-Felder (z.B. alter) nicht speichern – Wert wird dynamisch berechnet
    if (col.readonly) continue;
    if (data[col.key] !== undefined) {
      keys.push(`"${col.key}"`);
      placeholders.push('?');
      values.push(col.type === 'boolean' ? (data[col.key] ? 1 : 0) : data[col.key]);
    }
  }

  const sql = `INSERT INTO mitglieder (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
  const result = db.prepare(sql).run(...values);
  return getMemberById(result.lastInsertRowid);
}

/**
 * Mitglied aktualisieren
 */
function updateMember(id, data) {
  const spalten = config.spalten;
  const sets = [];
  const values = [];

  for (const col of spalten) {
    // Readonly-Felder (z.B. alter) nicht aktualisieren – Wert wird dynamisch berechnet
    if (col.readonly) continue;
    if (data[col.key] !== undefined) {
      sets.push(`"${col.key}" = ?`);
      values.push(col.type === 'boolean' ? (data[col.key] ? 1 : 0) : data[col.key]);
    }
  }

  sets.push('aktualisiert_am = CURRENT_TIMESTAMP');
  values.push(id);

  const sql = `UPDATE mitglieder SET ${sets.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...values);
  return getMemberById(id);
}

/**
 * Mitglied löschen
 */
function deleteMember(id) {
  return db.prepare('DELETE FROM mitglieder WHERE id = ?').run(id);
}

/**
 * Mitglieder suchen (Volltextsuche über alle Text-Spalten)
 */
function searchMembers(query) {
  const textSpalten = config.spalten.filter(s => s.type === 'text' || s.type === 'email');
  const conditions = textSpalten.map(s => `"${s.key}" LIKE ?`);
  const params = textSpalten.map(() => `%${query}%`);

  const sql = `SELECT * FROM mitglieder WHERE ${conditions.join(' OR ')} ORDER BY nachname, vorname`;
  return db.prepare(sql).all(...params).map(mitAlterAnreichern);
}

/**
 * Export-Vorlagen abrufen
 */
function getExportVorlagen() {
  const vorlagen = db.prepare('SELECT * FROM export_vorlagen ORDER BY name').all();
  return vorlagen.map(v => ({
    ...v,
    felder: JSON.parse(v.felder),
    filter: JSON.parse(v.filter),
    zeigeAnzahl: !!v.zeige_anzahl,
    zeigeDatum: !!v.zeige_datum
  }));
}

/**
 * Export-Vorlage erstellen
 */
function createExportVorlage(data) {
  const result = db.prepare(`
    INSERT INTO export_vorlagen (name, ueberschrift, felder, filter, zeige_anzahl, zeige_datum)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.name,
    data.ueberschrift || '',
    JSON.stringify(data.felder),
    JSON.stringify(data.filter || {}),
    data.zeigeAnzahl ? 1 : 0,
    data.zeigeDatum ? 1 : 0
  );
  return result.lastInsertRowid;
}

/**
 * Export-Vorlage aktualisieren
 */
function updateExportVorlage(id, data) {
  db.prepare(`
    UPDATE export_vorlagen 
    SET name = ?, ueberschrift = ?, felder = ?, filter = ?, zeige_anzahl = ?, zeige_datum = ?
    WHERE id = ?
  `).run(
    data.name,
    data.ueberschrift || '',
    JSON.stringify(data.felder),
    JSON.stringify(data.filter || {}),
    data.zeigeAnzahl ? 1 : 0,
    data.zeigeDatum ? 1 : 0,
    id
  );
}

/**
 * Export-Vorlage löschen
 */
function deleteExportVorlage(id) {
  return db.prepare('DELETE FROM export_vorlagen WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Fisch des Jahres
// ---------------------------------------------------------------------------

function initFischDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fische (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kategorie TEXT NOT NULL,
      gesperrt_bis_jahr INTEGER,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS fisch_des_jahres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jahr INTEGER NOT NULL,
      kategorie TEXT NOT NULL,
      fisch_id INTEGER NOT NULL REFERENCES fische(id),
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(jahr, kategorie)
    )
  `);
}

function getAllFische(kategorie) {
  if (kategorie) {
    return db.prepare('SELECT * FROM fische WHERE kategorie = ? ORDER BY name').all(kategorie);
  }
  return db.prepare('SELECT * FROM fische ORDER BY kategorie, name').all();
}

function createFisch(name, kategorie) {
  const result = db.prepare('INSERT INTO fische (name, kategorie) VALUES (?, ?)').run(name, kategorie);
  return db.prepare('SELECT * FROM fische WHERE id = ?').get(result.lastInsertRowid);
}

function updateFisch(id, data) {
  const sets = [];
  const values = [];
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.gesperrt_bis_jahr !== undefined) { sets.push('gesperrt_bis_jahr = ?'); values.push(data.gesperrt_bis_jahr); }
  if (sets.length === 0) return db.prepare('SELECT * FROM fische WHERE id = ?').get(id);
  values.push(id);
  db.prepare(`UPDATE fische SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM fische WHERE id = ?').get(id);
}

function deleteFisch(id) {
  return db.prepare('DELETE FROM fische WHERE id = ?').run(id);
}

function getFischDesJahres(jahr, kategorie) {
  return db.prepare(`
    SELECT f.*, fj.jahr, fj.id as fj_id
    FROM fisch_des_jahres fj
    JOIN fische f ON f.id = fj.fisch_id
    WHERE fj.jahr = ? AND fj.kategorie = ?
  `).get(jahr, kategorie);
}

function getAllFischDesJahres() {
  return db.prepare(`
    SELECT fj.id, fj.jahr, fj.kategorie, fj.fisch_id, f.name as fisch_name
    FROM fisch_des_jahres fj
    JOIN fische f ON f.id = fj.fisch_id
    ORDER BY fj.jahr DESC, fj.kategorie
  `).all();
}

function setFischDesJahres(jahr, kategorie, fischId) {
  // Upsert
  db.prepare(`
    INSERT INTO fisch_des_jahres (jahr, kategorie, fisch_id)
    VALUES (?, ?, ?)
    ON CONFLICT(jahr, kategorie) DO UPDATE SET fisch_id = excluded.fisch_id
  `).run(jahr, kategorie, fischId);
  // Sperre automatisch setzen
  db.prepare('UPDATE fische SET gesperrt_bis_jahr = ? WHERE id = ?').run(jahr + 3, fischId);
  return getFischDesJahres(jahr, kategorie);
}

function getMitgliederAnzahlNachKategorie() {
  const gesamt = db.prepare('SELECT COUNT(*) as count FROM mitglieder').get().count;

  // Unterstützt sowohl 'je' (Entwicklung) als auch 'j/e' (Produktion) als Spaltenname
  const jeField = config.spalten.find(s => s.key === 'je' || s.key === 'j/e');
  if (!jeField) return { jugend: 0, erwachsene: 0, gesamt };

  // Spaltenname in Anführungszeichen – wichtig für 'j/e', da / sonst als Division gilt
  const col = `"${jeField.key}"`;

  const jugend = db.prepare(`SELECT COUNT(*) as count FROM mitglieder WHERE UPPER(TRIM(${col})) = 'J'`).get().count;
  const erwachsene = db.prepare(`SELECT COUNT(*) as count FROM mitglieder WHERE UPPER(TRIM(${col})) = 'E'`).get().count;

  return { jugend, erwachsene, gesamt };
}

/**
 * Alle Spalten aus der config zurückgeben, ergänzt um den sichtbar-Status aus der DB
 */
function getSpaltenMitSichtbarkeit() {
  return config.spalten.map(col => {
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(`spalte_sichtbar_${col.key}`);
    // Wenn kein Eintrag gefunden, gilt die Spalte als sichtbar
    const sichtbar = setting ? setting.value === '1' : true;
    return { ...col, sichtbar };
  });
}

/**
 * Sichtbarkeit einer Spalte in der DB speichern
 */
function setSpaltenSichtbar(key, sichtbar) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    `spalte_sichtbar_${key}`,
    sichtbar ? '1' : '0'
  );
}

// ---------------------------------------------------------------------------
// Terminplan
// ---------------------------------------------------------------------------

function initTerminDatabase() {
  // Einzelne Termine pro Jahr
  db.exec(`
    CREATE TABLE IF NOT EXISTS termine (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jahr INTEGER NOT NULL,
      datum TEXT NOT NULL,
      ausweichtermin TEXT,
      uhrzeit TEXT,
      ort TEXT,
      beschreibung TEXT,
      reihenfolge INTEGER DEFAULT 0,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Entwurf/Freigabe-Status pro Jahr
  db.exec(`
    CREATE TABLE IF NOT EXISTS terminplan_jahre (
      jahr INTEGER PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'entwurf',
      freigegeben_am TEXT
    )
  `);
}

// Alle Termine eines Jahres, sortiert nach Datum
function getAllTermine(jahr) {
  return db.prepare(
    'SELECT * FROM termine WHERE jahr = ? ORDER BY datum, reihenfolge'
  ).all(jahr);
}

// Nächste N Termine ab heute, nur aus freigegebenen Jahren
function getNaechsteTermine(limit = 2) {
  const heute = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return db.prepare(`
    SELECT t.*
    FROM termine t
    JOIN terminplan_jahre tj ON tj.jahr = t.jahr
    WHERE tj.status = 'freigegeben'
      AND t.datum >= ?
    ORDER BY t.datum, t.reihenfolge
    LIMIT ?
  `).all(heute, limit);
}

// Termin anlegen
function createTermin(data) {
  const result = db.prepare(`
    INSERT INTO termine (jahr, datum, ausweichtermin, uhrzeit, ort, beschreibung, reihenfolge)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.jahr,
    data.datum,
    data.ausweichtermin || null,
    data.uhrzeit || null,
    data.ort || null,
    data.beschreibung || null,
    data.reihenfolge || 0
  );
  return db.prepare('SELECT * FROM termine WHERE id = ?').get(result.lastInsertRowid);
}

// Termin aktualisieren
function updateTermin(id, data) {
  db.prepare(`
    UPDATE termine
    SET datum = ?, ausweichtermin = ?, uhrzeit = ?, ort = ?, beschreibung = ?, reihenfolge = ?,
        aktualisiert_am = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.datum,
    data.ausweichtermin || null,
    data.uhrzeit || null,
    data.ort || null,
    data.beschreibung || null,
    data.reihenfolge || 0,
    id
  );
  return db.prepare('SELECT * FROM termine WHERE id = ?').get(id);
}

// Termin löschen
function deleteTermin(id) {
  return db.prepare('DELETE FROM termine WHERE id = ?').run(id);
}

// Status eines Jahres abrufen (gibt null zurück wenn noch kein Eintrag existiert)
function getTerminplanStatus(jahr) {
  return db.prepare('SELECT * FROM terminplan_jahre WHERE jahr = ?').get(jahr);
}

// Status eines Jahres setzen (Upsert)
function setTerminplanStatus(jahr, status) {
  const freigegeben_am = status === 'freigegeben' ? new Date().toISOString() : null;
  db.prepare(`
    INSERT INTO terminplan_jahre (jahr, status, freigegeben_am)
    VALUES (?, ?, ?)
    ON CONFLICT(jahr) DO UPDATE SET status = excluded.status, freigegeben_am = excluded.freigegeben_am
  `).run(jahr, status, freigegeben_am);
  return db.prepare('SELECT * FROM terminplan_jahre WHERE jahr = ?').get(jahr);
}

// Termine eines Jahres in ein anderes Jahr kopieren (Datum wird um +1 Jahr verschoben)
function kopierTermineVonJahr(vonJahr, nachJahr) {
  const quellTermine = db.prepare(
    'SELECT * FROM termine WHERE jahr = ? ORDER BY datum, reihenfolge'
  ).all(vonJahr);

  if (quellTermine.length === 0) return 0;

  // Hilfsfunktion: Jahreszahl im ISO-Datum ersetzen, z.B. "2026-04-15" → "2027-04-15"
  const verschiebeJahr = (isoDate, zielJahr) => {
    if (!isoDate) return null;
    return `${zielJahr}${isoDate.slice(4)}`;
  };

  const insert = db.prepare(`
    INSERT INTO termine (jahr, datum, ausweichtermin, uhrzeit, ort, beschreibung, reihenfolge)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Alle Termine in einer Transaktion einfügen (schneller und sicher)
  const alleEinfuegen = db.transaction((termine) => {
    for (const t of termine) {
      insert.run(
        nachJahr,
        verschiebeJahr(t.datum, nachJahr),
        verschiebeJahr(t.ausweichtermin, nachJahr),
        t.uhrzeit || null,
        t.ort || null,
        t.beschreibung || null,
        t.reihenfolge || 0
      );
    }
  });

  alleEinfuegen(quellTermine);
  return quellTermine.length;
}

// Alle Jahre mit Status – plus Jahre die Termine haben aber noch keinen Status-Eintrag
function getAllTerminplanJahre() {
  // Jahre aus der terminplan_jahre-Tabelle
  const mitStatus = db.prepare('SELECT * FROM terminplan_jahre ORDER BY jahr DESC').all();
  // Jahre aus termine-Tabelle die noch keinen Status-Eintrag haben
  const ohneStatus = db.prepare(`
    SELECT DISTINCT jahr FROM termine
    WHERE jahr NOT IN (SELECT jahr FROM terminplan_jahre)
    ORDER BY jahr DESC
  `).all();
  // Zusammenführen: Einträge ohne Status bekommen default 'entwurf'
  const ohneStatusMapped = ohneStatus.map(r => ({ jahr: r.jahr, status: 'entwurf', freigegeben_am: null }));
  return [...mitStatus, ...ohneStatusMapped].sort((a, b) => b.jahr - a.jahr);
}

// --- test helpers -----------------------------------------------------------

function deleteAllMembers() {
  return db.prepare('DELETE FROM mitglieder').run();
}

function deleteAllExportVorlagen() {
  return db.prepare('DELETE FROM export_vorlagen').run();
}

/**
 * Führt beliebiges SQL aus (nur für Tests/Interna)
 */
function runRaw(sql, params = []) {
  return db.prepare(sql).run(...params);
}

/**
 * Anzahl Mitglieder mit Filter
 */
function countMembers(filter = {}) {
  let sql = 'SELECT COUNT(*) as count FROM mitglieder';
  const { conditions, params } = buildFilterConditions(filter);

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  return db.prepare(sql).get(...params).count;
}

module.exports = {
  db,
  initializeDatabase,
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  searchMembers,
  getExportVorlagen,
  deleteAllMembers,
  deleteAllExportVorlagen,
  runRaw,
  createExportVorlage,
  updateExportVorlage,
  deleteExportVorlage,
  countMembers,
  getAllFische,
  createFisch,
  updateFisch,
  deleteFisch,
  getFischDesJahres,
  getAllFischDesJahres,
  setFischDesJahres,
  getMitgliederAnzahlNachKategorie,
  getSpaltenMitSichtbarkeit,
  setSpaltenSichtbar,
  getAllTermine,
  getNaechsteTermine,
  createTermin,
  updateTermin,
  deleteTermin,
  getTerminplanStatus,
  setTerminplanStatus,
  getAllTerminplanJahre,
  kopierTermineVonJahr
};
