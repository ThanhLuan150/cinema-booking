const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

// GET /api/payments/my -> the caller's own payment history
router.get('/payments/my', requireAuth, requirePermission('payment.read'), asyncHandler(paymentController.myPayments));

// GET /api/payments -> payments visible to the caller (BRANCH/ALL scope), filterable by status/type
router.get('/payments', requireAuth, requirePermission('payment.read'), asyncHandler(paymentController.adminPayments));

// GET /api/payments/:code/status -> verify a single payment's current lifecycle status
router.get(
  '/payments/:code/status',
  requireAuth,
  requirePermission('payment.read'),
  asyncHandler(paymentController.getPaymentStatus),
);

// POST /api/payments/:id/refund/request { reason } -> PAID -> REFUND_PENDING
router.post(
  '/payments/:id/refund/request',
  requireAuth,
  requirePermission('booking.refund'),
  asyncHandler(paymentController.requestRefund),
);

// POST /api/payments/:id/refund/confirm -> REFUND_PENDING -> REFUNDED
router.post(
  '/payments/:id/refund/confirm',
  requireAuth,
  requirePermission('booking.refund'),
  asyncHandler(paymentController.confirmRefund),
);

module.exports = router;
