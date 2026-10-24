const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const groupBookingController = require('../controllers/groupBooking.controller');

const router = express.Router();

router.post('/quote', requireAuth, requirePermission('booking.create'), asyncHandler(groupBookingController.quote));

// POST /api/group-bookings -> claims every seat + PENDING booking + payment, returns the MoMo link
router.post(
  '/',
  requireAuth,
  requirePermission('booking.create'),
  requirePermission('payment.create'),
  asyncHandler(groupBookingController.checkout),
);

// GET /api/group-bookings/:code -> the group booking with its seats, combos, payment and tickets
router.get('/:code', requireAuth, requirePermission('booking.read'), asyncHandler(groupBookingController.getByCode));

// POST /api/group-bookings/:code/cancel -> gives up a PENDING group booking, releasing every seat
router.post('/:code/cancel', requireAuth, requirePermission('booking.cancel'), asyncHandler(groupBookingController.cancel));

// POST /api/group-bookings/:code/momo-confirm -> the browser's MoMo result (signature-verified; owner only)
router.post('/:code/momo-confirm', requireAuth, asyncHandler(groupBookingController.momoConfirm));

module.exports = router;
