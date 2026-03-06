const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireRole } = require('../middleware/roleCheck');

// GET /api/mitglieder - Alle Mitglieder abrufen
router.get('/', requireRole('viewer'), (req, res) => {
  try {
    const filter = {};
    // Filter aus Query-Parametern extrahieren
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'suche') {
        filter[key] = value;
      }
    }

    // Suche
    if (req.query.suche) {
      const members = db.searchMembers(req.query.suche);
      return res.json(members);
    }

    const members = db.getAllMembers(filter);
    res.json(members);
  } catch (error) {
    console.error('Fehler beim Abrufen der Mitglieder:', error);
    res.status(500).json({ fehler: 'Fehler beim Abrufen der Mitglieder' });
  }
});

// GET /api/mitglieder/anzahl - Anzahl Mitglieder mit Filter
router.get('/anzahl', requireRole('viewer'), (req, res) => {
  try {
    const filter = { ...req.query };
    const count = db.countMembers(filter);
    res.json({ anzahl: count });
  } catch (error) {
    console.error('Fehler beim Zählen der Mitglieder:', error);
    res.status(500).json({ fehler: 'Fehler beim Zählen der Mitglieder' });
  }
});

// GET /api/mitglieder/:id - Ein Mitglied abrufen
router.get('/:id', requireRole('viewer'), (req, res) => {
  try {
    const member = db.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ fehler: 'Mitglied nicht gefunden' });
    }
    res.json(member);
  } catch (error) {
    console.error('Fehler beim Abrufen des Mitglieds:', error);
    res.status(500).json({ fehler: 'Fehler beim Abrufen des Mitglieds' });
  }
});

// POST /api/mitglieder - Neues Mitglied anlegen
router.post('/', requireRole('editor'), (req, res) => {
  try {
    const member = db.createMember(req.body);
    res.status(201).json(member);
  } catch (error) {
    console.error('Fehler beim Anlegen des Mitglieds:', error);
    res.status(500).json({ fehler: 'Fehler beim Anlegen des Mitglieds: ' + error.message });
  }
});

// PUT /api/mitglieder/:id - Mitglied aktualisieren
router.put('/:id', requireRole('editor'), (req, res) => {
  try {
    const existing = db.getMemberById(req.params.id);
    if (!existing) {
      return res.status(404).json({ fehler: 'Mitglied nicht gefunden' });
    }
    const member = db.updateMember(req.params.id, req.body);
    res.json(member);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Mitglieds:', error);
    res.status(500).json({ fehler: 'Fehler beim Aktualisieren des Mitglieds: ' + error.message });
  }
});

// DELETE /api/mitglieder/:id - Mitglied löschen
router.delete('/:id', requireRole('editor'), (req, res) => {
  try {
    const existing = db.getMemberById(req.params.id);
    if (!existing) {
      return res.status(404).json({ fehler: 'Mitglied nicht gefunden' });
    }
    db.deleteMember(req.params.id);
    res.json({ nachricht: 'Mitglied gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Mitglieds:', error);
    res.status(500).json({ fehler: 'Fehler beim Löschen des Mitglieds' });
  }
});

module.exports = router;
