const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const kdsController = require('../controllers/kds.controller');

const router = express.Router();

// Every KDS route is pinned to one branch in the URL: requireBranchAccess lets in the branch's owner,
// an Employee actively staffed there, or the Super Admin (ALL scope), and the controller then refuses
// any order whose branch is not that one. No new permissions: the KDS is the kitchen's view of combo
// orders, so it reuses combo.order.view / combo.order.update (F&B Staff and Concession Staff hold both).
const kdsBranch = (req) => {
  const branchId = Number(req.params.branchId);
  return Number.isInteger(branchId) ? branchId : null;
};

// GET /api/kds/branches -> branches the caller may open on the KDS, with waiting-order counts
router.get(
  '/branches',
  requireAuth,
  requirePermission('combo.order.view'),
  asyncHandler(kdsController.listBranches),
);

// GET /api/kds/branches/:branchId/orders?status=NEW,PREPARING&recentMinutes=60
router.get(
  '/branches/:branchId/orders',
  requireAuth,
  requirePermission('combo.order.view'),
  requireBranchAccess(kdsBranch),
  asyncHandler(kdsController.getBoard),
);

// PATCH /api/kds/branches/:branchId/orders/:id/status { status: PREPARING|READY|COMPLETED|CANCELLED, reason? }
router.patch(
  '/branches/:branchId/orders/:id/status',
  requireAuth,
  requirePermission('combo.order.update'),
  requireBranchAccess(kdsBranch),
  asyncHandler(kdsController.updateStatus),
);

module.exports = router;
