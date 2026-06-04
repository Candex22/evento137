const express = require('express');
const router = express.Router();
const { login, register, logout, me } = require('../controllers/authcontroller');
const { requireAuth } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

module.exports = router;