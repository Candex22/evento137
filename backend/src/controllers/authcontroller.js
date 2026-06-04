const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// POST /api/auth/login — equivalente a login.php
async function login(req, res) {
  const { correo_electronico, contrasena } = req.body;

  if (!correo_electronico || !contrasena) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correo_electronico)) {
    return res.status(400).json({ error: 'Formato de correo electrónico no válido.' });
  }

  try {
    const result = await pool.query(
      'SELECT id_user, contrasena, rol, estado, name_user FROM usuario WHERE correo_electronico = $1',
      [correo_electronico]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'No se encontró una cuenta con ese correo electrónico.' });
    }

    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(contrasena, user.contrasena);

    if (!passwordOk) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    if (user.estado === 'pendiente') {
      return res.status(403).json({ error: 'Su cuenta está pendiente de aprobación por un administrador.' });
    }
    if (user.estado === 'inactivo') {
      return res.status(403).json({ error: 'Su cuenta ha sido desactivada. Contacte con un administrador.' });
    }
    if (user.estado !== 'activo') {
      return res.status(403).json({ error: `Estado de cuenta inválido: ${user.estado}` });
    }

    // Guardar sesión
    req.session.usuario_registrado = true;
    req.session.id_usuario = user.id_user;
    req.session.correo_electronico = correo_electronico;
    req.session.rol = user.rol;
    req.session.name_user = user.name_user;

    return res.json({
      message: 'Sesión iniciada correctamente.',
      usuario: {
        id: user.id_user,
        name_user: user.name_user,
        rol: user.rol,
      },
    });
  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// POST /api/auth/register — registro de nuevo usuario (estado: pendiente)
async function register(req, res) {
  const { name_user, nombre, apellido, correo_electronico, contrasena } = req.body;

  if (!name_user || !nombre || !apellido || !correo_electronico || !contrasena) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correo_electronico)) {
    return res.status(400).json({ error: 'Formato de correo electrónico no válido.' });
  }

  if (contrasena.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    // Verificar duplicados
    const existe = await pool.query(
      'SELECT id_user FROM usuario WHERE correo_electronico = $1 OR name_user = $2',
      [correo_electronico, name_user]
    );
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'El correo electrónico o nombre de usuario ya está registrado.' });
    }

    const hash = await bcrypt.hash(contrasena, 10);

    await pool.query(
      `INSERT INTO usuario (name_user, nombre, apellido, correo_electronico, contrasena, rol, estado)
       VALUES ($1, $2, $3, $4, $5, 'mozo', 'pendiente')`,
      [name_user, nombre, apellido, correo_electronico, hash]
    );

    return res.status(201).json({
      message: 'Registro exitoso. Su cuenta está pendiente de aprobación por un administrador.',
    });
  } catch (err) {
    console.error('Error en register:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// POST /api/auth/logout — equivalente a logout.php
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Sesión cerrada correctamente.' });
  });
}

// GET /api/auth/me — devuelve datos de la sesión activa
function me(req, res) {
  if (!req.session.usuario_registrado) {
    return res.status(401).json({ error: 'No hay sesión activa.' });
  }
  return res.json({
    id: req.session.id_usuario,
    name_user: req.session.name_user,
    correo_electronico: req.session.correo_electronico,
    rol: req.session.rol,
  });
}

module.exports = { login, register, logout, me };