const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const pricingRuleController = require('../controllers/pricingRule.controller');

const router = express.Router();

// GET /api/pricingRule?branchId= -> management list (owner sees only their own branches'
// rules + global ones, admin sees all)
router.get('/', requireAuth, requirePermission('pricingRule.read'), asyncHandler(pricingRuleController.list));

// GET /api/pricingRule/:id
router.get('/:id', requireAuth, requirePermission('pricingRule.read'), asyncHandler(pricingRuleController.getById));

// POST /api/pricingRule (pricingRule.create permission; branch_id null = admin only)
router.post('/', requireAuth, requirePermission('pricingRule.create'), asyncHandler(pricingRuleController.create));

// PUT /api/pricingRule/:id (pricingRule.update permission, scoped)
router.put('/:id', requireAuth, requirePermission('pricingRule.update'), asyncHandler(pricingRuleController.update));

// DELETE /api/pricingRule/:id (pricingRule.delete permission, scoped)
router.delete('/:id', requireAuth, requirePermission('pricingRule.delete'), asyncHandler(pricingRuleController.remove));

module.exports = router;
