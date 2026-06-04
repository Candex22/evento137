// Verifica que el usuario haya iniciado sesión
function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario_registrado) {
    return res.status(401).json({ error: 'No autorizado. Iniciá sesión primero.' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.usuario_registrado) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    if (!roles.includes(req.session.rol)) {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }
    next();
  };
}
const requireAdmin = requireRole('administrador');

module.exports = { requireAuth, requireAdmin, requireRole };
