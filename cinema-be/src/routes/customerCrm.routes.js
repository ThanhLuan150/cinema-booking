const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const customerCrmController = require('../controllers/customerCrm.controller');

const router = express.Router();

// GET /api/crm/me — the caller's own CRM / activity summary.
router.get('/me', requireAuth, requirePermission('crm.viewOwn'), asyncHandler(customerCrmController.myProfile));

// GET /api/crm/customers/:accountId — staff/admin view of one customer, branch-scoped the
// same way the revenue reports are.
router.get(
  '/customers/:accountId',
  requireAuth,
  requirePermission('crm.viewCustomer'),
  asyncHandler(customerCrmController.customerProfile),
);

module.exports = router;
