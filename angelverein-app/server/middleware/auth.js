/**
 * Middleware: Prüft ob der Benutzer eingeloggt ist
 * Lässt nur authentifizierte Requests durch
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ fehler: 'Nicht autorisiert. Bitte einloggen.' });
}

module.exports = { requireAuth };
