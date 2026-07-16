const express = require('express');
const requireAuth = require('../middleware/auth');
const { getProducts } = require('../controllers/products.controller');

const router = express.Router();

router.get('/', requireAuth, getProducts);

module.exports = router;
