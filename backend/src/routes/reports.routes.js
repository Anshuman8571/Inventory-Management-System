const express = require('express');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { getSummary } = require('../controllers/reports.controller');

const router = express.Router();

// Owner-only — this surfaces cost/value data, which prd.md keeps restricted from staff.
router.get('/summary', requireAuth, requireRole('owner'), getSummary);

module.exports = router;