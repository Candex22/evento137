const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const {
  getProductos, crearProducto, agregarGusto,
  cargarStock, ajustarStock, ajustarGusto, actualizarPrecio,
} = require('../controllers/stockcontroller');

router.use(requireRole('buffet', 'administrador'));

router.get('/productos', getProductos);
router.post('/productos', crearProducto);
router.post('/productos/:id/gustos', agregarGusto);
router.post('/ingresos', cargarStock);
router.patch('/productos/:id/ajustar', ajustarStock);
router.patch('/gustos/:id/ajustar', ajustarGusto);

module.exports = router;