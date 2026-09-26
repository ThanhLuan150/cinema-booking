const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { requireBranchOwnership } = require('../middleware/ownership');
const inventoryRepository = require('../repositories/inventory.repository');
const inventoryController = require('../controllers/inventory.controller');

const router = express.Router();

// GET /api/inventory?branchId=&status=&category=&q=&page=&limit= -> items visible to the caller
// (inventory.view: BRANCH for Branch Admin, ALL for Super Admin)
router.get('/', requireAuth, requirePermission('inventory.view'), asyncHandler(inventoryController.list));

// GET /api/inventory/alerts?branchId= -> low-stock/out-of-stock items (must be registered
// before the /:id route below or Express would match "alerts" as an id)
router.get('/alerts', requireAuth, requirePermission('inventory.view'), asyncHandler(inventoryController.listAlerts));

// GET /api/inventory/categories?branchId= -> distinct product categories (also before /:id)
router.get(
  '/categories',
  requireAuth,
  requirePermission('inventory.view'),
  asyncHandler(inventoryController.listCategories),
);

// GET /api/inventory/:id
router.get('/:id', requireAuth, requirePermission('inventory.view'), asyncHandler(inventoryController.getById));

// GET /api/inventory/:id/history?type=&page=&limit= -> Lịch sử kho
router.get(
  '/:id/history',
  requireAuth,
  requirePermission('inventory.view'),
  asyncHandler(inventoryController.getHistory),
);

// POST /api/inventory { branch_id, item, unit, sku?, category?, combo_id?, quantity?, minimum_quantity?,
//                       cost_price?, selling_price? }
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

// Stock movements — all inventory.manage + owner-scoped, each leaves one history row:
// POST /api/inventory/:id/import { quantity, reason? } -> Nhập kho (IMPORT)
// POST /api/inventory/:id/return { quantity, reason? } -> Trả hàng về kho (RETURN)
// POST /api/inventory/:id/adjust { quantity, reason? } -> Điều chỉnh kho (ADJUSTMENT, absolute count)
// POST /api/inventory/:id/waste  { quantity, reason? } -> Hủy hàng (WASTE)
// (SALE rows are written by the combo-sale flow, never by a direct call.)
const stockMovementRoutes = [
  ['import', inventoryController.importStock],
  ['return', inventoryController.returnStock],
  ['adjust', inventoryController.adjust],
  ['waste', inventoryController.waste],
];
for (const [path, handler] of stockMovementRoutes) {
  router.post(
    `/:id/${path}`,
    requireAuth,
    requirePermission('inventory.manage'),
    requireBranchOwnership((req) => inventoryRepository.findBranchIdById(req.params.id)),
    asyncHandler(handler),
  );
}

module.exports = router;
