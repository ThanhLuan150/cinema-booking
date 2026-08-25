const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const refundController = require('../controllers/refund.controller');

const router = express.Router();

// POST /api/refunds { booking_id, reason } -> customer requests a refund (OWN scope) or staff
// raises one on a customer's behalf (BRANCH/ALL scope)
router.post('/refunds', requireAuth, requirePermission('refund.request'), asyncHandler(refundController.requestRefund));

// GET /api/refunds/my -> the caller's own refund requests
router.get('/refunds/my', requireAuth, requirePermission('refund.read'), asyncHandler(refundController.myRefunds));

// GET /api/refunds?status=&page=&limit= -> refunds visible to the caller (BRANCH/ALL scope)
router.get('/refunds', requireAuth, requirePermission('refund.read'), asyncHandler(refundController.listRefunds));

// GET /api/refunds/:id
router.get('/refunds/:id', requireAuth, requirePermission('refund.read'), asyncHandler(refundController.getRefundById));

// POST /api/refunds/:id/approve { note } -> REQUESTED -> APPROVED
router.post(
  '/refunds/:id/approve',
  requireAuth,
  requirePermission('refund.approve'),
  asyncHandler(refundController.approveRefund),
);

// POST /api/refunds/:id/reject { reason } -> REQUESTED -> REJECTED
router.post(
  '/refunds/:id/reject',
  requireAuth,
  requirePermission('refund.approve'),
  asyncHandler(refundController.rejectRefund),
);

// POST /api/refunds/:id/process -> APPROVED -> PROCESSING
router.post(
  '/refunds/:id/process',
  requireAuth,
  requirePermission('refund.process'),
  asyncHandler(refundController.processRefund),
);

// POST /api/refunds/:id/complete -> PROCESSING -> COMPLETED (marks Payment refunded, releases tickets)
router.post(
  '/refunds/:id/complete',
  requireAuth,
  requirePermission('refund.process'),
  asyncHandler(refundController.completeRefund),
);

// POST /api/refunds/:id/fail { reason } -> PROCESSING -> FAILED
router.post(
  '/refunds/:id/fail',
  requireAuth,
  requirePermission('refund.process'),
  asyncHandler(refundController.failRefund),
);

module.exports = router;
