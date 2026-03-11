const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/roleCheck');
const {
  getAllFische,
  createFisch,
  updateFisch,
  deleteFisch,
  getFischDesJahres,
  getAllFischDesJahres,
  setFischDesJahres,
  getMitgliederAnzahlNachKategorie
} = require('../database');

// Dashboard-Daten: Mitgliederzahlen + aktueller Fisch des Jahres (viewer+)
router.get('/dashboard', requireRole('viewer'), (req, res) => {
  try {
    const jahr = new Date().getFullYear();
    const mitglieder = getMitgliederAnzahlNachKategorie();
    const fischJ = getFischDesJahres(jahr, 'J');
    const fischE = getFischDesJahres(jahr, 'E');
    res.json({
      mitglieder,
      fischDesJahres: {
        jahr,
        jugend: fischJ ? { id: fischJ.id, name: fischJ.name } : null,
        erwachsene: fischE ? { id: fischE.id, name: fischE.name } : null
      }
    });
  } catch (err) {
    res.status(500).json({ fehler: err.message });
  }
});

// Alle Jahresauswahlen abrufen (admin)
router.get('/jahresauswahl', requireRole('admin'), (req, res) => {
  try {
    res.json(getAllFischDesJahres());
  } catch (err) {
    res.status(500).json({ fehler: err.message });
  }
});

// Fisch des Jahres setzen (admin)
router.post('/jahresauswahl', requireRole('admin'), (req, res) => {
  try {
    const { jahr, kategorie, fisch_id } = req.body;
    if (!jahr || !kategorie || !fisch_id) {
      return res.status(400).json({ fehler: 'jahr, kategorie und fisch_id sind erforderlich' });
    }
    if (!['J', 'E'].includes(kategorie)) {
      return res.status(400).json({ fehler: 'kategorie muss J oder E sein' });
    }
    const result = setFischDesJahres(Number(jahr), kategorie, Number(fisch_id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ fehler: err.message });
  }
});

// Alle Fische abrufen (admin), optional ?kategorie=J|E
router.get('/', requireRole('admin'), (req, res) => {
  try {
    const { kategorie } = req.query;
    res.json(getAllFische(kategorie || null));
  } catch (err) {
    res.status(500).json({ fehler: err.message });
  }
});

// Fisch anlegen (admin)
router.post('/', requireRole('admin'), (req, res) => {
  try {
    const { name, kategorie } = req.body;
    if (!name || !kategorie) {
      return res.status(400).json({ fehler: 'name und kategorie sind erforderlich' });
    }
    if (!['J', 'E'].includes(kategorie)) {
      return res.status(400).json({ fehler: 'kategorie muss J oder E sein' });
    }
    res.status(201).json(createFisch(name.trim(), kategorie));
  } catch (err) {
    res.status(500).json({ fehler: err.message });
  }
});

// Fisch bearbeiten (admin)
router.put('/:id', requireRole('admin'), (req, res) => {
  try {
    const { name, gesperrt_bis_jahr } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (gesperrt_bis_jahr !== undefined) {
      data.gesperrt_bis_jahr = gesperrt_bis_jahr === null || gesperrt_bis_jahr === '' ? null : Number(gesperrt_bis_jahr);
    }
    res.json(updateFisch(Number(req.params.id), data));
  } catch (err) {
    res.status(500).json({ fehler: err.message });
  }
});

// Fisch löschen (admin)
router.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    deleteFisch(Number(req.params.id));
    res.json({ erfolg: true });
  } catch (err) {
    res.status(500).json({ fehler: err.message });
  }
});

module.exports = router;
