require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const buffetRoutes = require('./routes/buffet');
const mozoRoutes = require('./routes/mozo');
const cajeroRoutes = require('./routes/cajero');
const entradasRoutes = require('./routes/entradas');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5137',
  credentials: true, // necesario para enviar cookies de sesión
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesiones (equivalente a session_start() en PHP)
app.use(session({
  secret: process.env.SESSION_SECRET || 'secreto_por_defecto_cambiar',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8, // 8 horas
  },
}));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/buffet', buffetRoutes);
app.use('/api/mozo', mozoRoutes);
app.use('/api/cajero', cajeroRoutes);
app.use('/api/entradas', entradasRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});