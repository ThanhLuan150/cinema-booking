const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const comboOrderController = require('../controllers/comboOrder.controller');

const router = express.Router();

// POST /api/combo-orders { branch_id, account_id?, booking_id?, items: [{ combo_id, quantity }] }
// (combo.sell permission, branch-scoped to the target branch — Combo Staff/Cashier sell here)
router.post(
  '/',
  requireAuth,
  requirePermission('combo.sell'),
  requireBranchAccess((req) => Number(req.body.branch_id)),
  asyncHandler(comboOrderController.createOrder),
);

// GET /api/combo-orders?status=&branchId=&page=&limit= -> orders visible to the caller
router.get('/', requireAuth, requirePermission('combo.order.view'), asyncHandler(comboOrderController.listOrders));

// GET /api/combo-orders/:id
router.get('/:id', requireAuth, requirePermission('combo.order.view'), asyncHandler(comboOrderController.getOrderById));

// POST /api/combo-orders/:id/pay { method: 'CASH' | 'MOMO' } -> PENDING -> PAID
router.post('/:id/pay', requireAuth, requirePermission('payment.create'), asyncHandler(comboOrderController.payOrder));

// POST /api/combo-orders/:id/prepare -> PAID -> PREPARING
router.post(
  '/:id/prepare',
  requireAuth,
  requirePermission('combo.order.update'),
  asyncHandler(comboOrderController.prepareOrder),
);

// POST /api/combo-orders/:id/ready -> PREPARING -> READY
router.post(
  '/:id/ready',
  requireAuth,
  requirePermission('combo.order.update'),
  asyncHandler(comboOrderController.readyOrder),
);

// POST /api/combo-orders/:id/deliver -> READY -> DELIVERED
router.post(
  '/:id/deliver',
  requireAuth,
  requirePermission('combo.order.update'),
  asyncHandler(comboOrderController.deliverOrder),
);

// POST /api/combo-orders/:id/cancel { reason } -> PENDING/PAID/PREPARING -> CANCELLED
router.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('combo.order.update'),
  asyncHandler(comboOrderController.cancelOrder),
);

module.exports = router;
