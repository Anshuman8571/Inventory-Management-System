const express = require('express');
const { uploadBill, confirmBill } = require('../controllers/bills.controller');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.post('/', requireRole(['owner', 'staff']), uploadBill);
router.post('/:id/confirm', requireRole(['owner', 'staff']), confirmBill);

module.exports = router;
