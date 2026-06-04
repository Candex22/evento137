const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { pedidosPendientes, confirmarPedido, rechazarPedido, historialCajero, porCobrar, marcarPagado } = require('../controllers/pedidoController');
const { getProductos, actualizarPrecio } = require('../controllers/stockController');

router.use(requireRole('cajero', 'administrador'));

router.get('/pedidos', pedidosPendientes);
router.patch('/pedidos/:id/confirmar', confirmarPedido);
router.patch('/pedidos/:id/rechazar', rechazarPedido);
router.patch('/pedidos/:id/pagar', marcarPagado);      // confirma el cobro

router.get('/por-cobrar', porCobrar);                   // aceptados sin pagar
router.get('/historial', historialCajero);              // resueltos por este cajero
router.get('/productos', getProductos);                 // lista con precios
router.patch('/productos/:id/precio', actualizarPrecio); // fija el precio

module.exports = router;