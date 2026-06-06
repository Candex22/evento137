const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { getProductos, crearIngreso, ajustarStock } = require('../controllers/stockcontroller');

router.use(requireRole('buffet', 'admin'));

router.get('/productos', getProductos);
router.post('/ingresos', crearIngreso);
router.patch('/productos/:id/ajustar', ajustarStock);

module.exports = router;