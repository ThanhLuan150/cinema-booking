const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const reportingController = require('../controllers/reporting.controller');

const router = express.Router();

router.get(
  '/financial',
  requireAuth,
  requirePermission('report.viewFinancial'),
  asyncHandler(reportingController.financial),
);

// Non-financial operational metrics for the EMPLOYEE dashboard (also available to
// BRANCH_ADMIN / SUPER_ADMIN), branch-scoped the same way.
router.get(
  '/operational',
  requireAuth,
  requirePermission('report.viewOperational'),
  asyncHandler(reportingController.operational),
);

module.exports = router;
