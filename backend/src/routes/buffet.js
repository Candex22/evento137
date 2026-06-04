const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { getProductos, crearIngreso } = require('../controllers/stockController');

router.use(requireRole('buffet', 'administrador'));

router.get('/productos', getProductos);
router.post('/ingresos', crearIngreso);

module.exports = router;