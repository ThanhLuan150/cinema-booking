const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const holidayController = require('../controllers/holiday.controller');

const router = express.Router();

// GET /api/pricingHoliday?branchId= -> management list
router.get('/', requireAuth, requirePermission('pricingRule.read'), asyncHandler(holidayController.list));

// POST /api/pricingHoliday { date, name, branch_id } (branch_id null = admin only)
router.post('/', requireAuth, requirePermission('pricingRule.create'), asyncHandler(holidayController.create));

// PUT /api/pricingHoliday/:id (scoped)
router.put('/:id', requireAuth, requirePermission('pricingRule.update'), asyncHandler(holidayController.update));

// DELETE /api/pricingHoliday/:id (scoped)
router.delete('/:id', requireAuth, requirePermission('pricingRule.delete'), asyncHandler(holidayController.remove));

module.exports = router;
