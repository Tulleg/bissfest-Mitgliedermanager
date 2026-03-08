const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireRole } = require('../middleware/roleCheck');
const pdfGenerator = require('../utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf-8'));

// GET /api/export/vorlagen - Alle Export-Vorlagen abrufen
router.get('/vorlagen', requireRole('admin'), (req, res) => {
  try {
    const vorlagen = db.getExportVorlagen();
    res.json(vorlagen);
  } catch (error) {
    console.error('Fehler beim Abrufen der Vorlagen:', error);
    res.status(500).json({ fehler: 'Fehler beim Abrufen der Vorlagen' });
  }
});

// POST /api/export/vorlagen - Neue Export-Vorlage erstellen
router.post('/vorlagen', requireRole('admin'), (req, res) => {
  try {
    const id = db.createExportVorlage(req.body);
    res.status(201).json({ id, nachricht: 'Vorlage erstellt' });
  } catch (error) {
    console.error('Fehler beim Erstellen der Vorlage:', error);
    res.status(500).json({ fehler: 'Fehler beim Erstellen der Vorlage' });
  }
});

// PUT /api/export/vorlagen/:id - Export-Vorlage aktualisieren
router.put('/vorlagen/:id', requireRole('admin'), (req, res) => {
  try {
    db.updateExportVorlage(req.params.id, req.body);
    res.json({ nachricht: 'Vorlage aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Vorlage:', error);
    res.status(500).json({ fehler: 'Fehler beim Aktualisieren der Vorlage' });
  }
});

// DELETE /api/export/vorlagen/:id - Export-Vorlage löschen
router.delete('/vorlagen/:id', requireRole('admin'), (req, res) => {
  try {
    db.deleteExportVorlage(req.params.id);
    res.json({ nachricht: 'Vorlage gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Vorlage:', error);
    res.status(500).json({ fehler: 'Fehler beim Löschen der Vorlage' });
  }
});

// POST /api/export/pdf - PDF generieren
router.post('/pdf', requireRole('admin'), async (req, res) => {
  try {
    const { vorlagenId, customConfig } = req.body;
    
    let exportConfig;
    
    if (vorlagenId) {
      // Vorlage aus DB laden (parseInt sichert Typ-Gleichheit bei ===)
      const vorlagenIdInt = parseInt(vorlagenId, 10);
      if (isNaN(vorlagenIdInt)) {
        return res.status(400).json({ fehler: 'Ungültige Vorlagen-ID' });
      }
      const vorlagen = db.getExportVorlagen();
      exportConfig = vorlagen.find(v => v.id === vorlagenIdInt);
      if (!exportConfig) {
        return res.status(404).json({ fehler: 'Vorlage nicht gefunden' });
      }
    } else if (customConfig) {
      exportConfig = customConfig;
    } else {
      return res.status(400).json({ fehler: 'Keine Vorlage oder Konfiguration angegeben' });
    }

    // Sicherstellen, dass Felder vorhanden sind
    if (!exportConfig.felder || !Array.isArray(exportConfig.felder) || exportConfig.felder.length === 0) {
      return res.status(400).json({ fehler: 'Export-Konfiguration muss mindestens ein Feld enthalten' });
    }

    // Mitglieder mit Filter abrufen
    const members = db.getAllMembers(exportConfig.filter || {});
    const count = db.countMembers(exportConfig.filter || {});
    console.log(`[PDF-Export] Vorlage: "${exportConfig.name}", Felder: ${JSON.stringify(exportConfig.felder)}, Filter: ${JSON.stringify(exportConfig.filter)}, Mitglieder gefunden: ${members.length}`);

    // Spalten-Labels aus Config holen
    const spaltenMap = {};
    for (const col of config.spalten) {
      spaltenMap[col.key] = col.label;
    }

    // PDF generieren (Promise zurückgeben und abwarten)
    const pdfBuffer = await pdfGenerator.generatePDF({
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

    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      console.warn('PDF-Generator lieferte leeres Ergebnis');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${exportConfig.name || 'export'}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Fehler beim PDF-Export:', error);
    res.status(500).json({ fehler: 'Fehler beim PDF-Export: ' + (error.message || error) });
  }
});

module.exports = router;
