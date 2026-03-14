const express = require('express');
const router = express.Router();
const { getAuditLog, getAllAuditLog, getAuditAktionen } = require('../audit-db');
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

// Audit-Log exportieren als CSV oder JSON (nur Admin)
// Query-Parameter: von, bis, aktion, format (csv|json)
router.get('/export', requireRole('admin'), (req, res) => {
  try {
    const { von, bis, aktion, format } = req.query;
    const eintraege = getAllAuditLog({
      von: von || undefined,
      bis: bis || undefined,
      aktion: aktion || undefined
    });

    const datum = new Date().toISOString().slice(0, 10); // "2026-03-14"

    if (format === 'json') {
      // JSON-Download
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${datum}.json"`);
      res.json(eintraege);
    } else {
      // CSV-Download (Standard)
      const zeilen = [];

      // Kopfzeile
      zeilen.push(['id', 'zeitstempel', 'benutzer_id', 'benutzername', 'aktion', 'entitaet', 'entitaet_id', 'details'].join(','));

      // Datenzeilen
      for (const e of eintraege) {
        const details = e.details !== null && e.details !== undefined
          ? `"${JSON.stringify(e.details).replace(/"/g, '""')}"` // Anführungszeichen in CSV escapen
          : '';
        zeilen.push([
          e.id,
          e.zeitstempel,
          e.benutzer_id ?? '',
          e.benutzername ?? '',
          e.aktion,
          e.entitaet ?? '',
          e.entitaet_id ?? '',
          details
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${datum}.csv"`);
      // BOM damit Excel die Datei korrekt als UTF-8 erkennt
      res.send('\uFEFF' + zeilen.join('\r\n'));
    }
  } catch (err) {
    console.error('Audit-Export Fehler:', err);
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
