const express = require('express');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { uploadBill, confirmBill } = require('../controllers/bills.controller');

const router = express.Router();

router.post('/', requireAuth, requireRole('owner', 'staff'), uploadBill);
router.post('/:id/confirm', requireAuth, requireRole('owner', 'staff'), confirmBill);

module.exports = router;