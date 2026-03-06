/**
 * Middleware: Prüft ob der Benutzer eingeloggt ist
 * Lässt nur authentifizierte Requests durch
 */
const { getUserById } = require('../auth-db');

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    // sicherstellen, dass Rolle im Session-Objekt vorhanden ist
    if (!req.session.role) {
      const user = getUserById(req.session.userId);
      req.session.role = user ? user.rolle : 'viewer';
    }
    return next();
  }
  res.status(401).json({ fehler: 'Nicht autorisiert. Bitte einloggen.' });
}

module.exports = { requireAuth };
