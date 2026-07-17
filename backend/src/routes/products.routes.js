const express = require('express');
const requireAuth = require('../middleware/auth');
const { getProducts, getHistory } = require('../controllers/products.controller');

const router = express.Router();

router.get('/', requireAuth, getProducts);
router.get('/:id/history', requireAuth, getHistory);

module.exports = router;