const express = require('express');
const requireAuth = require('../middleware/auth');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categories.controller');

const router = express.Router();

router.get('/', requireAuth, getCategories);
router.post('/', requireAuth, createCategory);
router.put('/:name', requireAuth, updateCategory);
router.delete('/:name', requireAuth, deleteCategory);

module.exports = router;