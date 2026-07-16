const express = require('express');
const requireAuth = require('../middleware/auth');
const { createScan, confirmScan } = require('../controllers/scan.controller');

const router = express.Router();

router.post('/', requireAuth, createScan);
router.post('/:id/confirm', requireAuth, confirmScan);

module.exports = router;
