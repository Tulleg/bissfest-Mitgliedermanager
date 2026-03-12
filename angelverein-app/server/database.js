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

  console.log('✅ Datenbank initialisiert');
}

/**
 * Alle Mitglieder abrufen mit optionalem Filter
 */
function getAllMembers(filter = {}) {
  let sql = 'SELECT * FROM mitglieder';
  const conditions = [];
  const params = [];

  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      conditions.push(`"${key}" LIKE ?`);
      params.push(`%${value}%`);
    }
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY nachname, vorname';
  return db.prepare(sql).all(...params);
}

/**
 * Ein Mitglied nach ID abrufen
 */
function getMemberById(id) {
  return db.prepare('SELECT * FROM mitglieder WHERE id = ?').get(id);
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
  return db.prepare(sql).all(...params);
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
  const conditions = [];
  const params = [];

  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      conditions.push(`"${key}" LIKE ?`);
      params.push(`%${value}%`);
    }
  }

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
  setSpaltenSichtbar
};
