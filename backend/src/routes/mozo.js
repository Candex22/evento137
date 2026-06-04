const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { getProductos } = require('../controllers/stockcontroller');
const { crearPedido, misPedidos } = require('../controllers/pedidocontroller');

router.use(requireRole('mozo', 'administrador'));

router.get('/productos', getProductos);   // ve el stock para armar el pedido
router.post('/pedidos', crearPedido);
router.get('/pedidos', misPedidos);

module.exports = router;