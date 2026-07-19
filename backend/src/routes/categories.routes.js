const express = require('express');
const requireAuth = require('../middleware/auth');
const { getCategories, createCategory } = require('../controllers/categories.controller');

const router = express.Router();

router.get('/', requireAuth, getCategories);
router.post('/', requireAuth, createCategory);

module.exports = router;