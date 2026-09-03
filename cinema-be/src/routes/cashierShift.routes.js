const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const cashierShiftController = require('../controllers/cashierShift.controller');

const router = express.Router();

// POST /api/cashier-shifts/open { branch_id, opening_cash, note }
// requireBranchAccess is what enforces "Shift phải thuộc đúng Branch" — only a branch the
// caller owns or is actively staffed at gets past it.
router.post(
  '/open',
  requireAuth,
  requirePermission('cashierShift.open'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(cashierShiftController.openShift),
);

// GET /api/cashier-shifts/current -> the caller's own open drawer. Static path, so it is
// declared before /:id or "current" would be parsed as a shift id.
router.get('/current', requireAuth, requirePermission('cashierShift.read'), asyncHandler(cashierShiftController.current));

// GET /api/cashier-shifts?branchId=&status=&employeeId= (scoped OWN/BRANCH/ALL)
router.get('/', requireAuth, requirePermission('cashierShift.read'), asyncHandler(cashierShiftController.list));

// GET /api/cashier-shifts/:id
router.get('/:id', requireAuth, requirePermission('cashierShift.read'), asyncHandler(cashierShiftController.getById));

// GET /api/cashier-shifts/:id/reconciliation
router.get(
  '/:id/reconciliation',
  requireAuth,
  requirePermission('cashierShift.read'),
  asyncHandler(cashierShiftController.reconciliation),
);

// POST /api/cashier-shifts/:id/close { actual_cash, note }
// Scope is checked in the controller rather than by requireBranchAccess: a cashier holds
// cashierShift.close at OWN scope (their own drawer only), a Branch Admin at BRANCH scope
// (so they can settle a drawer a cashier walked away from).
router.post(
  '/:id/close',
  requireAuth,
  requirePermission('cashierShift.close'),
  asyncHandler(cashierShiftController.closeShift),
);

module.exports = router;
