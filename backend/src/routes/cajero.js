const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { porCobrar, marcarPagado, historialCajero } = require('../controllers/pedidocontroller');

router.use(requireRole('cajero', 'admin'));

router.get('/por-cobrar', porCobrar);
router.patch('/pedidos/:id/pagar', marcarPagado);
router.get('/historial', historialCajero);

module.exports = router;