const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const purchaseOrderRepository = require('../repositories/purchaseOrder.repository');
const purchaseOrderController = require('../controllers/purchaseOrder.controller');

const router = express.Router();

const orderBranch = (req) => purchaseOrderRepository.findBranchIdById(req.params.id);

// Reads — purchaseOrder.read: BRANCH for a Branch Admin (their own branches), ALL for Super Admin,
// and BRANCH for an Employee only if their Position was granted it.
router.get('/', requireAuth, requirePermission('purchaseOrder.read'), asyncHandler(purchaseOrderController.list));
router.get('/:id', requireAuth, requirePermission('purchaseOrder.read'), asyncHandler(purchaseOrderController.getById));

// Managing the order itself (create / edit a draft / confirm / cancel / delete a draft) —
// purchaseOrder.manage and owner-scoped: a Branch Admin may only touch their own branch's orders.
router.post(
  '/',
  requireAuth,
  requirePermission('purchaseOrder.manage'),
  requireBranchOwnership((req) => Number(req.body.branch_id)),
  asyncHandler(purchaseOrderController.create),
);
router.put(
  '/:id',
  requireAuth,
  requirePermission('purchaseOrder.manage'),
  requireBranchOwnership(orderBranch),
  asyncHandler(purchaseOrderController.update),
);
router.delete(
  '/:id',
  requireAuth,
  requirePermission('purchaseOrder.manage'),
  requireBranchOwnership(orderBranch),
  asyncHandler(purchaseOrderController.remove),
);
router.post(
  '/:id/confirm',
  requireAuth,
  requirePermission('purchaseOrder.manage'),
  requireBranchOwnership(orderBranch),
  asyncHandler(purchaseOrderController.confirm),
);
router.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('purchaseOrder.manage'),
  requireBranchOwnership(orderBranch),
  asyncHandler(purchaseOrderController.cancel),
);

// Receiving stock is the one action that changes Inventory, so it has its own permission
// (purchaseOrder.receive) rather than riding on .manage. Held by Branch Admin/Super Admin by role;
// an Employee needs it granted through their Position AND must be actively staffed at the order's
// branch (requireBranchAccess) — an ordinary Employee has neither and gets 403.
router.post(
  '/:id/receive',
  requireAuth,
  requirePermission('purchaseOrder.receive'),
  requireBranchAccess(orderBranch),
  asyncHandler(purchaseOrderController.receive),
);

module.exports = router;
