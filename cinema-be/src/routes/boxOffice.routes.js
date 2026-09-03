const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const boxOfficeController = require('../controllers/boxOffice.controller');

const router = express.Router();

// POST /api/box-office/sell { scheduleId, ticketIds, comboIds, voucherCode, promotionCode,
router.post(
  '/sell',
  requireAuth,
  requirePermission('booking.create'),
  requirePermission('ticket.create'),
  requirePermission('payment.create'),
  requireBranchAccess((req) => Number(req.body.cinema_id)),
  asyncHandler(boxOfficeController.sellTickets),
);

// GET /api/box-office/bookings/:id/tickets -> reprint the tickets for a paid booking
router.get(
  '/bookings/:id/tickets',
  requireAuth,
  requirePermission('ticket.create'),
  asyncHandler(boxOfficeController.getBookingTickets),
);

module.exports = router;
