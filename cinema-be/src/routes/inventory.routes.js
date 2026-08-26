const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const inventoryRepository = require('../repositories/inventory.repository');
const inventoryController = require('../controllers/inventory.controller');

const router = express.Router();

// GET /api/inventory?branchId=&status=&page=&limit= -> items visible to the caller
// (inventory.view: BRANCH for Branch Admin, ALL for Super Admin)
router.get('/', requireAuth, requirePermission('inventory.view'), asyncHandler(inventoryController.list));

// GET /api/inventory/alerts?branchId= -> low-stock/out-of-stock items (must be registered
// before the /:id route below or Express would match "alerts" as an id)
router.get('/alerts', requireAuth, requirePermission('inventory.view'), asyncHandler(inventoryController.listAlerts));

// GET /api/inventory/:id
router.get('/:id', requireAuth, requirePermission('inventory.view'), asyncHandler(inventoryController.getById));

// GET /api/inventory/:id/history?page=&limit= -> Lịch sử kho
router.get(
  '/:id/history',
  requireAuth,
  requirePermission('inventory.view'),
  asyncHandler(inventoryController.getHistory),
);

// POST /api/inventory { branch_id, item, combo_id?, quantity?, minimum_quantity?, unit }
// (inventory.manage permission, owner-scoped — a Branch Admin may only manage their own branch)
router.post(
  '/',
  requireAuth,
  requirePermission('inventory.manage'),
  requireBranchOwnership((req) => Number(req.body.branch_id)),
  asyncHandler(inventoryController.create),
);

// PUT /api/inventory/:id (inventory.manage permission, owner-scoped)
router.put(
  '/:id',
  requireAuth,
  requirePermission('inventory.manage'),
  requireBranchOwnership((req) => inventoryRepository.findBranchIdById(req.params.id)),
  asyncHandler(inventoryController.update),
);

// DELETE /api/inventory/:id (inventory.manage permission, owner-scoped)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('inventory.manage'),
  requireBranchOwnership((req) => inventoryRepository.findBranchIdById(req.params.id)),
  asyncHandler(inventoryController.remove),
);

// POST /api/inventory/:id/receive { quantity, reason? } -> Nhập kho
router.post(
  '/:id/receive',
  requireAuth,
  requirePermission('inventory.manage'),
  requireBranchOwnership((req) => inventoryRepository.findBranchIdById(req.params.id)),
  asyncHandler(inventoryController.receive),
);

// POST /api/inventory/:id/adjust { quantity, reason? } -> Điều chỉnh kho
router.post(
  '/:id/adjust',
  requireAuth,
  requirePermission('inventory.manage'),
  requireBranchOwnership((req) => inventoryRepository.findBranchIdById(req.params.id)),
  asyncHandler(inventoryController.adjust),
);

// POST /api/inventory/:id/deduct { quantity, reason? } -> Trừ kho (manual)
router.post(
  '/:id/deduct',
  requireAuth,
  requirePermission('inventory.manage'),
  requireBranchOwnership((req) => inventoryRepository.findBranchIdById(req.params.id)),
  asyncHandler(inventoryController.deduct),
);

module.exports = router;
