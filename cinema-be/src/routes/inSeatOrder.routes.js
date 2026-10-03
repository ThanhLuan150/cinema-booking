const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const inSeatOrderController = require('../controllers/inSeatOrder.controller');
const inSeatOrderService = require('../services/inSeatOrder.service');

const router = express.Router();

// POST /api/in-seat/session { qr }
router.post(
  '/session',
  requireAuth,
  requirePermission('inSeatOrder.create'),
  asyncHandler(inSeatOrderController.session),
);

// POST /api/in-seat/orders { qr, items: [{ combo_id, quantity }] } -> PENDING order + MoMo pay_url
router.post(
  '/orders',
  requireAuth,
  requirePermission('inSeatOrder.create'),
  asyncHandler(inSeatOrderController.createOrder),
);

// GET /api/in-seat/orders?scheduleId= -> the caller's own in-seat orders
router.get('/orders', requireAuth, requirePermission('inSeatOrder.read'), asyncHandler(inSeatOrderController.listMine));

// GET /api/in-seat/orders/:code
router.get(
  '/orders/:code',
  requireAuth,
  requirePermission('inSeatOrder.read'),
  asyncHandler(inSeatOrderController.getOrder),
);

// POST /api/in-seat/orders/:code/momo-confirm { MoMo redirect params } -> applies the payment result
router.post(
  '/orders/:code/momo-confirm',
  requireAuth,
  requirePermission('inSeatOrder.create'),
  asyncHandler(inSeatOrderController.confirmMomo),
);

const showtimeBranch = (req) => {
  const scheduleId = Number(req.params.scheduleId);
  return Number.isInteger(scheduleId) && scheduleId > 0 ? inSeatOrderService.findScheduleBranchId(scheduleId) : null;
};

// GET /api/in-seat/showtimes/:scheduleId/seat-qr -> printable signed QR per seat
router.get(
  '/showtimes/:scheduleId/seat-qr',
  requireAuth,
  requirePermission('inSeatOrder.qr'),
  requireBranchAccess(showtimeBranch),
  asyncHandler(inSeatOrderController.seatQrSheet),
);

module.exports = router;
