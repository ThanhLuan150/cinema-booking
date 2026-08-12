const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const shiftRepository = require('../repositories/shift.repository');
const shiftController = require('../controllers/shift.controller');

const router = express.Router();

// GET /api/shift?branchId= (shift.read permission, owner-scoped — Branch Admin manages
// Shifts of their own branch)
router.get(
  '/',
  requireAuth,
  requirePermission('shift.read'),
  requireBranchOwnership((req) => Number(req.query.branchId)),
  asyncHandler(shiftController.list),
);

// POST /api/shift { branch_id, name, start_time, end_time } (shift.create permission, owner-scoped)
router.post(
  '/',
  requireAuth,
  requirePermission('shift.create'),
  requireBranchOwnership((req) => Number(req.body.branch_id)),
  asyncHandler(shiftController.create),
);

// PUT /api/shift/:id { name, start_time, end_time, status } (shift.update permission, owner-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('shift.update'),
  requireBranchOwnership((req) => shiftRepository.findBranchIdByShiftId(req.params.id)),
  asyncHandler(shiftController.update),
);

// DELETE /api/shift/:id (shift.delete permission, owner-scoped)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('shift.delete'),
  requireBranchOwnership((req) => shiftRepository.findBranchIdByShiftId(req.params.id)),
  asyncHandler(shiftController.remove),
);

module.exports = router;
