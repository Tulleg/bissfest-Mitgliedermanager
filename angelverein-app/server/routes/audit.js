const express = require('express');
const router = express.Router();
const { getAuditLog, getAuditAktionen } = require('../audit-db');
const { requireRole } = require('../middleware/roleCheck');

// Alle Audit-Einträge abrufen (nur Admin)
// Query-Parameter: von, bis, aktion, seite
router.get('/', requireRole('admin'), (req, res) => {
  try {
    const { von, bis, aktion, seite } = req.query;
    const ergebnis = getAuditLog({
      von: von || undefined,
      bis: bis || undefined,
      aktion: aktion || undefined,
      seite: seite ? parseInt(seite, 10) : 1
    });
    res.json(ergebnis);
  } catch (err) {
    console.error('Audit-Log Fehler:', err);
    res.status(500).json({ fehler: 'Interner Serverfehler' });
  }
});

// Alle vorkommenden Aktionstypen abrufen (für Dropdown-Filter)
router.get('/aktionen', requireRole('admin'), (req, res) => {
  try {
    const aktionen = getAuditAktionen();
    res.json(aktionen);
  } catch (err) {
    console.error('Audit-Aktionen Fehler:', err);
    res.status(500).json({ fehler: 'Interner Serverfehler' });
  }
});

module.exports = router;
