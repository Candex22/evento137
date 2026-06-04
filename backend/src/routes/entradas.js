const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { getEstado, getLista, generar, tachar, ajustarContador } = require('../controllers/entradacontroller');

router.use(requireRole('entradas', 'administrador'));

router.get('/estado', getEstado);
router.get('/lista', getLista);
router.post('/generar', generar);
router.patch('/:numero/tachar', tachar);
router.post('/contador', ajustarContador);

module.exports = router;