const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const excelParser = require('../utils/excelParser');
const pdfParser = require('../utils/pdfParser');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf-8'));

// Multer-Konfiguration für Datei-Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const allowedExtensions = ['.pdf', '.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF, Excel (.xlsx/.xls) und CSV Dateien sind erlaubt'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// POST /api/import/upload - Datei hochladen und parsen
router.post('/upload', upload.single('datei'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ fehler: 'Keine Datei hochgeladen' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    let importedData;

    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      importedData = excelParser.parseExcel(filePath);
    } else if (ext === '.pdf') {
      importedData = await pdfParser.parsePDF(filePath);
    } else {
      // Datei aufräumen
      fs.unlinkSync(filePath);
      return res.status(400).json({ fehler: 'Nicht unterstütztes Dateiformat' });
    }

    // Datei aufräumen
    fs.unlinkSync(filePath);

    if (!importedData || importedData.length === 0) {
      return res.status(400).json({ fehler: 'Keine Daten in der Datei gefunden' });
    }

    // Spalten-Mapping vorschlagen
    const importedHeaders = Object.keys(importedData[0]);
    const configSpalten = config.spalten.map(s => ({ key: s.key, label: s.label }));
    
    // Automatisches Mapping versuchen
    const mapping = {};
    for (const header of importedHeaders) {
      const headerLower = header.toLowerCase().trim();
      for (const spalte of configSpalten) {
        if (
          headerLower === spalte.key.toLowerCase() ||
          headerLower === spalte.label.toLowerCase() ||
          headerLower.includes(spalte.key.toLowerCase()) ||
          headerLower.includes(spalte.label.toLowerCase())
        ) {
          mapping[header] = spalte.key;
          break;
        }
      }
    }

    res.json({
      importierteDaten: importedData,
      importierteHeader: importedHeaders,
      verfuegbareSpalten: configSpalten,
      vorgeschlagenesMapping: mapping,
      anzahlZeilen: importedData.length
    });
  } catch (error) {
    console.error('Fehler beim Import:', error);
    // Datei aufräumen bei Fehler
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ fehler: 'Fehler beim Import: ' + error.message });
  }
});

// POST /api/import/abgleich - Importierte Daten mit Mitgliederliste abgleichen
router.post('/abgleich', (req, res) => {
  try {
    const { daten, mapping, abgleichFeld } = req.body;
    
    if (!daten || !mapping) {
      return res.status(400).json({ fehler: 'Daten und Mapping sind erforderlich' });
    }

    // Abgleichfeld bestimmen (Standard: mitgliedsnummer oder nachname+vorname)
    const matchField = abgleichFeld || 'mitgliedsnummer';
    
    const existingMembers = db.getAllMembers();
    
    const ergebnis = {
      uebereinstimmungen: [],  // Existiert und stimmt überein
      unterschiede: [],         // Existiert aber mit Unterschieden
      neu: [],                  // Existiert nicht in der DB
      nichtInImport: []         // Existiert in DB aber nicht im Import
    };

    // Importierte Daten mappen
    const mappedData = daten.map(row => {
      const mapped = {};
      for (const [importHeader, configKey] of Object.entries(mapping)) {
        if (configKey && row[importHeader] !== undefined) {
          mapped[configKey] = String(row[importHeader]).trim();
        }
      }
      return mapped;
    });

    // Set der importierten Match-Werte
    const importMatchValues = new Set();

    for (const importRow of mappedData) {
      const matchValue = importRow[matchField];
      if (!matchValue) continue;
      
      importMatchValues.add(matchValue);

      // In bestehenden Mitgliedern suchen
      const existing = existingMembers.find(m => 
        String(m[matchField]).trim().toLowerCase() === matchValue.toLowerCase()
      );

      if (existing) {
        // Unterschiede prüfen
        const diffs = {};
        let hasDiffs = false;
        
        for (const [key, value] of Object.entries(importRow)) {
          if (key === matchField) continue;
          const existingValue = String(existing[key] || '').trim();
          const importValue = String(value || '').trim();
          
          if (existingValue !== importValue && importValue !== '') {
            diffs[key] = { alt: existingValue, neu: importValue };
            hasDiffs = true;
          }
        }

        if (hasDiffs) {
          ergebnis.unterschiede.push({
            id: existing.id,
            bestehendesDaten: existing,
            importierteDaten: importRow,
            unterschiede: diffs
          });
        } else {
          ergebnis.uebereinstimmungen.push({
            id: existing.id,
            daten: existing
          });
        }
      } else {
        ergebnis.neu.push(importRow);
      }
    }

    // Mitglieder die nicht im Import sind
    for (const member of existingMembers) {
      const matchValue = String(member[matchField]).trim();
      if (!importMatchValues.has(matchValue)) {
        ergebnis.nichtInImport.push(member);
      }
    }

    res.json(ergebnis);
  } catch (error) {
    console.error('Fehler beim Abgleich:', error);
    res.status(500).json({ fehler: 'Fehler beim Abgleich: ' + error.message });
  }
});

// POST /api/import/uebernehmen - Änderungen übernehmen
router.post('/uebernehmen', (req, res) => {
  try {
    const { neueEintraege, aktualisierungen } = req.body;
    let erstellt = 0;
    let aktualisiert = 0;

    // Neue Mitglieder anlegen
    if (neueEintraege && neueEintraege.length > 0) {
      for (const entry of neueEintraege) {
        db.createMember(entry);
        erstellt++;
      }
    }

    // Bestehende Mitglieder aktualisieren
    if (aktualisierungen && aktualisierungen.length > 0) {
      for (const update of aktualisierungen) {
        if (update.id && update.daten) {
          db.updateMember(update.id, update.daten);
          aktualisiert++;
        }
      }
    }

    res.json({
      nachricht: `${erstellt} neue Mitglieder angelegt, ${aktualisiert} aktualisiert`,
      erstellt,
      aktualisiert
    });
  } catch (error) {
    console.error('Fehler beim Übernehmen:', error);
    res.status(500).json({ fehler: 'Fehler beim Übernehmen: ' + error.message });
  }
});

module.exports = router;
