const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

// GET /api/owner/dashboard?cinemaId= -> revenue/tickets/occupancy scoped to the caller's cinema(s)
router.get('/owner/dashboard', requireAuth, requirePermission('dashboard.view'), asyncHandler(dashboardController.ownerDashboard));

// GET /api/admin/dashboard -> system-wide totals (dashboard.viewSystem permission — super admin only)
router.get('/admin/dashboard', requireAuth, requirePermission('dashboard.viewSystem'), asyncHandler(dashboardController.adminDashboard));

module.exports = router;
