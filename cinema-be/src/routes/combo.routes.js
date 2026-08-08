const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const comboRepository = require('../repositories/combo.repository');
const comboController = require('../controllers/combo.controller');

const router = express.Router();

// GET /api/combo?branchId= -> with a branchId, public list of active combos for that branch
// (used by customers during checkout). Without branchId, this is the management view: a
// theater owner gets only their own cinemas' combos (any status), admin gets everything.
router.get('/', optionalAuth, asyncHandler(comboController.list));

// GET /api/combo/:id
router.get('/:id', asyncHandler(comboController.getById));

// POST /api/combo { cinema_id, name, description, price, image } (owner/admin)
router.post(
  '/',
  requireAuth,
  requirePermission('combo.create'),
  requireBranchOwnership((req) => Number(req.body.cinema_id)),
  asyncHandler(comboController.create),
);

// PUT /api/combo/:id (combo.update permission, owner-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('combo.update'),
  requireBranchOwnership((req) => comboRepository.findbranchIdByComboId(req.params.id)),
  asyncHandler(comboController.update),
);

// DELETE /api/combo/:id (combo.delete permission, owner-scoped)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('combo.delete'),
  requireBranchOwnership((req) => comboRepository.findbranchIdByComboId(req.params.id)),
  asyncHandler(comboController.remove),
);

module.exports = router;
