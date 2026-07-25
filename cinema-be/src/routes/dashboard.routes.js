const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

// GET /api/owner/dashboard?cinemaId= -> revenue/tickets/occupancy scoped to the caller's cinema(s)
router.get('/owner/dashboard', requireAuth, requireRole(0, 2), asyncHandler(dashboardController.ownerDashboard));

// GET /api/admin/dashboard -> system-wide totals (admin only)
router.get('/admin/dashboard', requireAuth, requireRole(0), asyncHandler(dashboardController.adminDashboard));

module.exports = router;
