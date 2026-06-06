const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { getProductos } = require('../controllers/stockcontroller');
const { crearPedido, misPedidos } = require('../controllers/pedidocontroller');
const { getCombosMozo } = require('../controllers/combocontroller');

router.use(requireRole('mozo', 'admin'));

router.get('/productos', getProductos);
router.post('/pedidos', crearPedido);
router.get('/pedidos', misPedidos);
router.get('/combos', getCombosMozo);

module.exports = router;