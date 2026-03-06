const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { getUser, getUserById, createUser, createUserWithRole, updateUserPassword, updateUserRole, deleteUser, getAllUsers, countUsers } = require('../auth-db');
const { requireRole } = require('../middleware/roleCheck');

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ fehler: 'Benutzername und Passwort erforderlich' });
    }

    const user = getUser(username);
    if (!user) {
      return res.status(401).json({ fehler: 'Ungültige Anmeldedaten' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    console.log('Login compare result:', valid, 'for user:', username, 'hash starts with:', user.password_hash.substring(0, 10));

    // Session setzen (inkl. Rolle)
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.rolle || 'viewer';

    res.json({ 
      erfolg: true, 
      benutzer: { 
        id: user.id, 
        username: user.username,
        rolle: req.session.role
      } 
    });
  } catch (err) {
    console.error('Login-Fehler:', err);
    res.status(500).json({ fehler: 'Interner Serverfehler' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ fehler: 'Logout fehlgeschlagen' });
    }
    res.clearCookie('angelverein.sid');
    res.json({ erfolg: true });
  });
});

// Auth-Status prüfen
router.get('/check', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ 
      eingeloggt: true, 
      benutzer: { 
        id: req.session.userId, 
        username: req.session.username,
        rolle: req.session.role || 'viewer'
      } 
    });
  } else {
    res.json({ eingeloggt: false });
  }
});

// Setup-Status prüfen (gibt es schon einen Benutzer?)
router.get('/setup', (req, res) => {
  const count = countUsers();
  res.json({ setupErforderlich: count === 0 });
});

// Ersteinrichtung - ersten Benutzer anlegen
router.post('/setup', async (req, res) => {
  try {
    const count = countUsers();
    if (count > 0) {
      return res.status(400).json({ fehler: 'Setup bereits abgeschlossen. Benutzer existiert bereits.' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ fehler: 'Benutzername und Passwort erforderlich' });
    }

    if (password.length < 6) {
      return res.status(400).json({ fehler: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    const hash = await bcrypt.hash(password, 12);
    console.log('Generated hash for setup:', hash);
    // erster Nutzer immer Admin
    const user = createUserWithRole(username, hash, 'admin');

    // Direkt einloggen, Rolle setzen
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = 'admin';

    res.json({ 
      erfolg: true, 
      benutzer: { 
        id: user.id, 
        username: user.username,
        rolle: 'admin'
      } 
    });
  } catch (err) {
    console.error('Setup-Fehler:', err);
    res.status(500).json({ fehler: 'Fehler beim Erstellen des Benutzers' });
  }
});

// Passwort ändern (eigener Account)
router.post('/passwort-aendern', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ fehler: 'Nicht eingeloggt' });
  }

  try {
    const { altesPasswort, neuesPasswort } = req.body;

    if (!altesPasswort || !neuesPasswort) {
      return res.status(400).json({ fehler: 'Altes und neues Passwort erforderlich' });
    }

    if (neuesPasswort.length < 6) {
      return res.status(400).json({ fehler: 'Neues Passwort muss mindestens 6 Zeichen lang sein' });
    }

    const user = getUser(req.session.username);
    const valid = await bcrypt.compare(altesPasswort, user.password_hash);
    if (!valid) {
      return res.status(401).json({ fehler: 'Altes Passwort ist falsch' });
    }

    const hash = await bcrypt.hash(neuesPasswort, 12);
    updateUserPassword(user.id, hash);

    res.json({ erfolg: true });
  } catch (err) {
    console.error('Passwort-Änderung-Fehler:', err);
    res.status(500).json({ fehler: 'Fehler beim Ändern des Passworts' });
  }
});

// Admin: Passwort eines anderen Benutzers zurücksetzen
router.put('/users/:id/passwort', requireRole('admin'), async (req, res) => {
  const targetId = req.params.id;
  const { neuesPasswort } = req.body;
  if (!neuesPasswort || neuesPasswort.length < 6) {
    return res.status(400).json({ fehler: 'Neues Passwort muss mindestens 6 Zeichen lang sein' });
  }
  try {
    const hash = await bcrypt.hash(neuesPasswort, 12);
    updateUserPassword(targetId, hash);
    res.json({ erfolg: true });
  } catch (err) {
    console.error('Admin Passwort Reset Fehler:', err);
    res.status(500).json({ fehler: 'Fehler beim Zurücksetzen des Passworts' });
  }
});

// Admin: Nutzerverwaltung (CRUD)
router.get('/users', requireRole('admin'), (req, res) => {
  try {
    const users = getAllUsers();
    res.json(users);
  } catch (err) {
    console.error('Fehler beim Abrufen der Nutzer:', err);
    res.status(500).json({ fehler: 'Fehler beim Abrufen der Nutzer' });
  }
});

router.post('/users', requireRole('admin'), async (req, res) => {
  try {
    const { username, password, rolle } = req.body;
    if (!username || !password) {
      return res.status(400).json({ fehler: 'Benutzername und Passwort erforderlich' });
    }
    if (password.length < 6) {
      return res.status(400).json({ fehler: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }
    const allowedRoles = ['viewer', 'editor', 'admin'];
    const r = allowedRoles.includes(rolle) ? rolle : 'viewer';
    const hash = await bcrypt.hash(password, 12);
    const user = createUserWithRole(username, hash, r);
    res.status(201).json(user);
  } catch (err) {
    console.error('Fehler beim Erstellen des Nutzers:', err);
    res.status(500).json({ fehler: 'Fehler beim Erstellen des Nutzers' });
  }
});

router.put('/users/:id/rolle', requireRole('admin'), (req, res) => {
  try {
    const { rolle } = req.body;
    const allowedRoles = ['viewer', 'editor', 'admin'];
    if (!allowedRoles.includes(rolle)) {
      return res.status(400).json({ fehler: 'Ungültige Rolle' });
    }
    updateUserRole(req.params.id, rolle);
    res.json({ erfolg: true });
  } catch (err) {
    console.error('Fehler beim Ändern der Rolle:', err);
    res.status(500).json({ fehler: 'Fehler beim Ändern der Rolle' });
  }
});

router.delete('/users/:id', requireRole('admin'), (req, res) => {
  try {
    deleteUser(req.params.id);
    res.json({ erfolg: true });
  } catch (err) {
    console.error('Fehler beim Löschen des Nutzers:', err);
    res.status(500).json({ fehler: 'Fehler beim Löschen des Nutzers' });
  }
});

module.exports = router;
