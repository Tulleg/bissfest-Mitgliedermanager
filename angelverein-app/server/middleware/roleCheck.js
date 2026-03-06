/**
 * Middleware zur Überprüfung von Benutzerrollen
 * @param {string} requiredRole - die minimale Rolle, die benötigt wird
 *  ("viewer", "editor", "admin").
 * Rollen sind hierarchisch: admin > editor > viewer.
 */
function requireRole(requiredRole) {
  const order = ['viewer', 'editor', 'admin'];

  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ fehler: 'Nicht autorisiert. Bitte einloggen.' });
    }

    const userRole = req.session.role || 'viewer';
    const userIndex = order.indexOf(userRole);
    const requiredIndex = order.indexOf(requiredRole);
    if (userIndex === -1 || requiredIndex === -1) {
      return res.status(500).json({ fehler: 'Unbekannte Rolle konfiguriert' });
    }

    if (userIndex >= requiredIndex) {
      return next();
    }

    res.status(403).json({ fehler: 'Unzureichende Berechtigungen' });
  };
}

module.exports = { requireRole };
