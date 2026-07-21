const express = require('express');
const requireAuth = require('../middleware/auth');
const { getProducts, getHistory, updateProduct, deleteProduct } = require('../controllers/products.controller');

const router = express.Router();

router.get('/', requireAuth, getProducts);
router.get('/:id/history', requireAuth, getHistory);
router.patch('/:id', requireAuth, updateProduct);
router.delete('/:id', requireAuth, deleteProduct);

module.exports = router;