const express = require('express');
const router = express.Router();
const db = require('../database');
const pdfGenerator = require('../utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf-8'));

// GET /api/export/vorlagen - Alle Export-Vorlagen abrufen
router.get('/vorlagen', (req, res) => {
  try {
    const vorlagen = db.getExportVorlagen();
    res.json(vorlagen);
  } catch (error) {
    console.error('Fehler beim Abrufen der Vorlagen:', error);
    res.status(500).json({ fehler: 'Fehler beim Abrufen der Vorlagen' });
  }
});

// POST /api/export/vorlagen - Neue Export-Vorlage erstellen
router.post('/vorlagen', (req, res) => {
  try {
    const id = db.createExportVorlage(req.body);
    res.status(201).json({ id, nachricht: 'Vorlage erstellt' });
  } catch (error) {
    console.error('Fehler beim Erstellen der Vorlage:', error);
    res.status(500).json({ fehler: 'Fehler beim Erstellen der Vorlage' });
  }
});

// PUT /api/export/vorlagen/:id - Export-Vorlage aktualisieren
router.put('/vorlagen/:id', (req, res) => {
  try {
    db.updateExportVorlage(req.params.id, req.body);
    res.json({ nachricht: 'Vorlage aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Vorlage:', error);
    res.status(500).json({ fehler: 'Fehler beim Aktualisieren der Vorlage' });
  }
});

// DELETE /api/export/vorlagen/:id - Export-Vorlage löschen
router.delete('/vorlagen/:id', (req, res) => {
  try {
    db.deleteExportVorlage(req.params.id);
    res.json({ nachricht: 'Vorlage gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Vorlage:', error);
    res.status(500).json({ fehler: 'Fehler beim Löschen der Vorlage' });
  }
});

// POST /api/export/pdf - PDF generieren
router.post('/pdf', (req, res) => {
  try {
    const { vorlagenId, customConfig } = req.body;
    
    let exportConfig;
    
    if (vorlagenId) {
      // Vorlage aus DB laden
      const vorlagen = db.getExportVorlagen();
      exportConfig = vorlagen.find(v => v.id === vorlagenId);
      if (!exportConfig) {
        return res.status(404).json({ fehler: 'Vorlage nicht gefunden' });
      }
    } else if (customConfig) {
      exportConfig = customConfig;
    } else {
      return res.status(400).json({ fehler: 'Keine Vorlage oder Konfiguration angegeben' });
    }

    // Mitglieder mit Filter abrufen
    const members = db.getAllMembers(exportConfig.filter || {});
    const count = db.countMembers(exportConfig.filter || {});

    // Spalten-Labels aus Config holen
    const spaltenMap = {};
    for (const col of config.spalten) {
      spaltenMap[col.key] = col.label;
    }

    // PDF generieren
    const pdfBuffer = pdfGenerator.generatePDF({
      vereinsname: config.vereinsname,
      ueberschrift: exportConfig.ueberschrift || 'Mitgliederliste',
      felder: exportConfig.felder,
      spaltenLabels: spaltenMap,
      mitglieder: members,
      anzahl: count,
      zeigeAnzahl: exportConfig.zeigeAnzahl,
      zeigeDatum: exportConfig.zeigeDatum,
      filter: exportConfig.filter
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${exportConfig.name || 'export'}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Fehler beim PDF-Export:', error);
    res.status(500).json({ fehler: 'Fehler beim PDF-Export: ' + error.message });
  }
});

module.exports = router;
