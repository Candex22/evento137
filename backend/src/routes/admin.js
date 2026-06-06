const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
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

} = require('../controllers/userscontroller');
const { getMovimientos, getProductosAdmin, actualizarPrecio } = require('../controllers/stockcontroller');
const { getCombosAdmin, crearCombo, actualizarCombo, eliminarCombo } = require('../controllers/combocontroller');
const { historialAdmin } = require('../controllers/pedidocontroller');

router.use(requireAuth, requireAdmin);

router.get('/pendientes', getPendientes);
router.get('/pendientes/count', countPendientes);
router.post('/pendientes/:id/aprobar', aprobarUsuario);
router.delete('/pendientes/:id', rechazarUsuario);

router.get('/usuarios', getUsuarios);
router.patch('/usuarios/:id/activar', activarUsuario);
router.patch('/usuarios/:id/desactivar', desactivarUsuario);
router.delete('/usuarios/:id', eliminarUsuario);

router.get('/roles', getUsuariosParaRoles);
router.patch('/roles/:id', cambiarRol); 

router.get('/movimientos', getMovimientos);

router.get('/pedidos', historialAdmin);   // historial completo de pedidos resueltos
router.get('/productos', getProductosAdmin);
router.patch('/productos/:id/precio', actualizarPrecio);

router.get('/combos', getCombosAdmin);
router.post('/combos', crearCombo);
router.put('/combos/:id', actualizarCombo);
router.delete('/combos/:id', eliminarCombo);
module.exports = router;