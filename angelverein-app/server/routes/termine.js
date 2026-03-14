const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { generateTerminplanPDF } = require('../utils/terminplanPdfGenerator');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config.json'), 'utf-8'));

// GET /api/termine/naechste
// Nächste 2 Termine ab heute (nur aus freigegebenen Jahren)
router.get('/naechste', requireAuth, (req, res) => {
  try {
    const termine = db.getNaechsteTermine(2);
    res.json(termine);
  } catch (error) {
    console.error('Fehler beim Laden der nächsten Termine:', error);
    res.status(500).json({ fehler: 'Termine konnten nicht geladen werden.' });
  }
});

// GET /api/termine/jahre
// Alle Jahre mit Terminplan-Status
router.get('/jahre', requireRole('viewer'), (req, res) => {
  try {
    const jahre = db.getAllTerminplanJahre();
    res.json(jahre);
  } catch (error) {
    console.error('Fehler beim Laden der Jahre:', error);
    res.status(500).json({ fehler: 'Jahre konnten nicht geladen werden.' });
  }
});

// GET /api/termine/export/pdf/:jahr
// PDF-Export für einen Terminplan
router.get('/export/pdf/:jahr', requireRole('viewer'), async (req, res) => {
  try {
    const jahr = parseInt(req.params.jahr, 10);
    if (isNaN(jahr)) return res.status(400).json({ fehler: 'Ungültiges Jahr.' });

    const termine = db.getAllTermine(jahr);
    // Fisch des Jahres aus der bestehenden DB-Funktion laden
    const fischJ = db.getFischDesJahres(jahr, 'J');
    const fischE = db.getFischDesJahres(jahr, 'E');

    const pdfBuffer = await generateTerminplanPDF({
      jahr,
      termine,
      fischDesJahres: { jugend: fischJ, erwachsene: fischE },
      terminplanConfig: config.terminplan || {},
      vereinsname: config.vereinsname || 'Angelverein'
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Terminplan_${jahr}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Fehler beim PDF-Export:', error);
    res.status(500).json({ fehler: 'PDF konnte nicht erstellt werden.' });
  }
});

// POST /api/termine/kopieren/:vonJahr/:nachJahr
// Termine eines Jahres in ein anderes Jahr kopieren (Daten um +1 Jahr verschoben)
router.post('/kopieren/:vonJahr/:nachJahr', requireRole('editor'), (req, res) => {
  try {
    const vonJahr = parseInt(req.params.vonJahr, 10);
    const nachJahr = parseInt(req.params.nachJahr, 10);

    if (isNaN(vonJahr) || isNaN(nachJahr)) {
      return res.status(400).json({ fehler: 'Ungültige Jahreszahl.' });
    }
    if (vonJahr === nachJahr) {
      return res.status(400).json({ fehler: 'Quell- und Zieljahr dürfen nicht gleich sein.' });
    }

    const kopiertAnzahl = db.kopierTermineVonJahr(vonJahr, nachJahr);
    if (kopiertAnzahl === 0) {
      return res.status(404).json({ fehler: `Keine Termine im Jahr ${vonJahr} gefunden.` });
    }

    // Zieljahr als Entwurf anlegen, falls noch kein Status-Eintrag existiert
    const statusEintrag = db.getTerminplanStatus(nachJahr);
    if (!statusEintrag) {
      db.setTerminplanStatus(nachJahr, 'entwurf');
    }

    // Alle neuen Termine des Zieljahres zurückgeben
    const termine = db.getAllTermine(nachJahr);
    res.json({ kopiertAnzahl, termine });
  } catch (error) {
    console.error('Fehler beim Kopieren der Termine:', error);
    res.status(500).json({ fehler: 'Termine konnten nicht kopiert werden.' });
  }
});

// GET /api/termine/:jahr
// Alle Termine eines Jahres
router.get('/:jahr', requireRole('viewer'), (req, res) => {
  try {
    const jahr = parseInt(req.params.jahr, 10);
    if (isNaN(jahr)) return res.status(400).json({ fehler: 'Ungültiges Jahr.' });

    const termine = db.getAllTermine(jahr);
    const status = db.getTerminplanStatus(jahr);
    res.json({ termine, status: status?.status || 'entwurf', freigegeben_am: status?.freigegeben_am || null });
  } catch (error) {
    console.error('Fehler beim Laden der Termine:', error);
    res.status(500).json({ fehler: 'Termine konnten nicht geladen werden.' });
  }
});

// POST /api/termine
// Neuen Termin anlegen
router.post('/', requireRole('editor'), (req, res) => {
  try {
    const { jahr, datum, ausweichtermin, uhrzeit, ort, beschreibung, reihenfolge } = req.body;
    if (!jahr || !datum) return res.status(400).json({ fehler: 'Jahr und Datum sind Pflichtfelder.' });

    const neuerTermin = db.createTermin({ jahr, datum, ausweichtermin, uhrzeit, ort, beschreibung, reihenfolge });
    res.status(201).json(neuerTermin);
  } catch (error) {
    console.error('Fehler beim Anlegen des Termins:', error);
    res.status(500).json({ fehler: 'Termin konnte nicht angelegt werden.' });
  }
});

// PUT /api/termine/status/:jahr
// Status eines Jahres setzen (entwurf oder freigegeben)
// Wichtig: muss VOR /:id stehen, sonst matcht Express "status" als id
router.put('/status/:jahr', requireRole('editor'), (req, res) => {
  try {
    const jahr = parseInt(req.params.jahr, 10);
    if (isNaN(jahr)) return res.status(400).json({ fehler: 'Ungültiges Jahr.' });

    const { status } = req.body;
    if (!['entwurf', 'freigegeben'].includes(status)) {
      return res.status(400).json({ fehler: 'Status muss "entwurf" oder "freigegeben" sein.' });
    }

    // Zurück zu Entwurf nur für Admin
    if (status === 'entwurf') {
      const aktuellerStatus = db.getTerminplanStatus(jahr);
      if (aktuellerStatus?.status === 'freigegeben' && req.session?.user?.rolle !== 'admin') {
        return res.status(403).json({ fehler: 'Nur Admins können einen freigegebenen Plan zurücksetzen.' });
      }
    }

    const ergebnis = db.setTerminplanStatus(jahr, status);
    res.json(ergebnis);
  } catch (error) {
    console.error('Fehler beim Setzen des Status:', error);
    res.status(500).json({ fehler: 'Status konnte nicht gesetzt werden.' });
  }
});

// PUT /api/termine/:id
// Termin bearbeiten
router.put('/:id', requireRole('editor'), (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ fehler: 'Ungültige ID.' });

    const { datum, ausweichtermin, uhrzeit, ort, beschreibung, reihenfolge } = req.body;
    if (!datum) return res.status(400).json({ fehler: 'Datum ist ein Pflichtfeld.' });

    const aktualisiert = db.updateTermin(id, { datum, ausweichtermin, uhrzeit, ort, beschreibung, reihenfolge });
    if (!aktualisiert) return res.status(404).json({ fehler: 'Termin nicht gefunden.' });
    res.json(aktualisiert);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Termins:', error);
    res.status(500).json({ fehler: 'Termin konnte nicht aktualisiert werden.' });
  }
});

// DELETE /api/termine/:id
// Termin löschen
router.delete('/:id', requireRole('editor'), (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ fehler: 'Ungültige ID.' });

    const result = db.deleteTermin(id);
    if (result.changes === 0) return res.status(404).json({ fehler: 'Termin nicht gefunden.' });
    res.json({ erfolg: true });
  } catch (error) {
    console.error('Fehler beim Löschen des Termins:', error);
    res.status(500).json({ fehler: 'Termin konnte nicht gelöscht werden.' });
  }
});

module.exports = router;
