const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { getProductos } = require('../controllers/stockController');
const { crearPedido, misPedidos } = require('../controllers/pedidoController');

router.use(requireRole('mozo', 'administrador'));

router.get('/productos', getProductos);   // ve el stock para armar el pedido
router.post('/pedidos', crearPedido);
router.get('/pedidos', misPedidos);

module.exports = router;