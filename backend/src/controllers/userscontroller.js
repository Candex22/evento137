const pool = require('../config/db');

// GET /api/admin/pendientes — equivalente a admin_pending.php (GET)
async function getPendientes(req, res) {
  try {
    const result = await pool.query(
      `SELECT id_user, name_user, nombre, apellido, correo_electronico
       FROM usuario WHERE estado = 'pendiente' ORDER BY id_user DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener pendientes:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// GET /api/admin/pendientes/count — badge del panel
async function countPendientes(req, res) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS total FROM usuario WHERE estado = 'pendiente'`
    );
    return res.json({ total: parseInt(result.rows[0].total, 10) });
  } catch (err) {
    console.error('Error al contar pendientes:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// POST /api/admin/pendientes/:id/aprobar — aprueba un usuario pendiente
async function aprobarUsuario(req, res) {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const result = await pool.query(
      `UPDATE usuario SET estado = 'activo' WHERE id_user = $1 AND estado = 'pendiente' RETURNING id_user`,
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario pendiente no encontrado.' });
    }
    return res.json({ message: 'Usuario aprobado correctamente.' });
  } catch (err) {
    console.error('Error al aprobar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// DELETE /api/admin/pendientes/:id — rechaza (elimina) un usuario pendiente
async function rechazarUsuario(req, res) {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const result = await pool.query(
      `DELETE FROM usuario WHERE id_user = $1 AND estado = 'pendiente' RETURNING id_user`,
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario pendiente no encontrado.' });
    }
    return res.json({ message: 'Usuario rechazado correctamente.' });
  } catch (err) {
    console.error('Error al rechazar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// GET /api/admin/usuarios — equivalente a admin_users.php (GET)
async function getUsuarios(req, res) {
  const idActual = req.session.id_usuario;
  try {
    const result = await pool.query(
      `SELECT id_user, name_user, nombre, apellido, correo_electronico, rol, estado
       FROM usuario WHERE id_user != $1 ORDER BY estado, id_user`,
      [idActual]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// PATCH /api/admin/usuarios/:id/activar
async function activarUsuario(req, res) {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'ID inválido.' });

  try {
    const result = await pool.query(
      `UPDATE usuario SET estado = 'activo' WHERE id_user = $1 RETURNING id_user`,
      [userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json({ message: 'Usuario activado correctamente.' });
  } catch (err) {
    console.error('Error al activar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// PATCH /api/admin/usuarios/:id/desactivar
async function desactivarUsuario(req, res) {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'ID inválido.' });

  // No puede desactivarse a sí mismo
  if (userId === req.session.id_usuario) {
    return res.status(403).json({ error: 'No puede desactivar su propia cuenta.' });
  }

  try {
    const result = await pool.query(
      `UPDATE usuario SET estado = 'inactivo' WHERE id_user = $1 RETURNING id_user`,
      [userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json({ message: 'Usuario desactivado correctamente.' });
  } catch (err) {
    console.error('Error al desactivar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// DELETE /api/admin/usuarios/:id
async function eliminarUsuario(req, res) {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'ID inválido.' });

  if (userId === req.session.id_usuario) {
    return res.status(403).json({ error: 'No puede eliminar su propia cuenta.' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM usuario WHERE id_user = $1 RETURNING id_user`,
      [userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json({ message: 'Usuario eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// GET /api/admin/roles — equivalente a admin_roles.php (GET)
async function getUsuariosParaRoles(req, res) {
  const idActual = req.session.id_usuario;
  try {
    const result = await pool.query(
      `SELECT id_user, name_user, nombre, apellido, correo_electronico, rol
       FROM usuario WHERE id_user != $1 AND estado = 'activo' ORDER BY rol DESC, nombre`,
      [idActual]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener usuarios para roles:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

const ROLES_VALIDOS = ['administrador', 'mozo', 'cajero', 'buffet'];

async function cambiarRol(req, res) {
  const userId = parseInt(req.params.id, 10);
  const { rol } = req.body;
  if (isNaN(userId)) return res.status(400).json({ error: 'ID inválido.' });
  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido.' });
  }
  // Evitar que el admin se quite el rol a sí mismo
  if (userId === req.session.id_usuario && rol !== 'admin') {
    return res.status(403).json({ error: 'No puede cambiar su propio rol de admin.' });
  }
  try {
    const result = await pool.query(
      `UPDATE usuario SET rol = $1 WHERE id_user = $2 AND estado = 'activo' RETURNING id_user`,
      [rol, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario activo no encontrado.' });
    return res.json({ message: `Rol actualizado a ${rol}.` });
  } catch (err) {
    console.error('Error al cambiar rol:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

module.exports = {
  getPendientes,
  countPendientes,
  aprobarUsuario,
  rechazarUsuario,
  getUsuarios,
  activarUsuario,
  desactivarUsuario,
  eliminarUsuario,
  getUsuariosParaRoles,
  cambiarRol,
};