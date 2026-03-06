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
      conditions.push(`"${key}" = ?`);
      params.push(value);
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
      conditions.push(`"${key}" = ?`);
      params.push(value);
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
  countMembers
};
