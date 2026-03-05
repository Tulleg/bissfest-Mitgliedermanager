const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { getUser, createUser, updateUserPassword, countUsers } = require('../auth-db');

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
    if (!valid) {
      return res.status(401).json({ fehler: 'Ungültige Anmeldedaten' });
    }

    // Session setzen
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ 
      erfolg: true, 
      benutzer: { 
        id: user.id, 
        username: user.username 
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
        username: req.session.username 
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
    const user = createUser(username, hash);

    // Direkt einloggen
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({ 
      erfolg: true, 
      benutzer: { 
        id: user.id, 
        username: user.username 
      } 
    });
  } catch (err) {
    console.error('Setup-Fehler:', err);
    res.status(500).json({ fehler: 'Fehler beim Erstellen des Benutzers' });
  }
});

// Passwort ändern (nur eingeloggt)
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

module.exports = router;
