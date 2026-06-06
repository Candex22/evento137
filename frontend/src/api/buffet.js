const { getProductos, crearIngreso, ajustarStock } = require('../controllers/stockcontroller');

router.use(requireRole('buffet', 'administrador'));

router.get('/productos', getProductos);
router.post('/ingresos', crearIngreso);
router.patch('/productos/:id/ajustar', ajustarStock);   // ← esta línea