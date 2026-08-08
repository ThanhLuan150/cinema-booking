const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireCinemaAccess } = require('../middleware/permission');
const bookingRepository = require('../repositories/booking.repository');
const bookingController = require('../controllers/booking.controller');

const router = express.Router();

// POST /api/scheduleId { movie_id, movie_date, time_begin } -> { id } (auth required)
router.post('/scheduleId', requireAuth, asyncHandler(bookingController.resolveScheduleId));

// GET /api/bookseat/:scheduleId -> seat grid for that schedule (auth required)
router.get('/bookseat/:scheduleId', requireAuth, asyncHandler(bookingController.bookseat));

// GET /api/bookticket/:movieId -> schedules for a movie, grouped by date (auth required)
router.get('/bookticket/:movieId', requireAuth, asyncHandler(bookingController.bookticket));

// POST /api/MomoPayment { ticketIds, comboIds, voucherCode, discountAmount, totalPrice }
// -> returns the MoMo payment redirect URL as a raw string (auth required). The booking
// details ride along in MoMo's extraData so the callback can finalize the exact order.
router.post('/MomoPayment', requireAuth, asyncHandler(bookingController.createMomoPayment));

// POST /api/MomoPayment/ipn -> MoMo's server-to-server payment confirmation (public;
// authenticated via MoMo's HMAC signature instead of our own JWT since MoMo can't hold one).
router.post('/MomoPayment/ipn', asyncHandler(bookingController.momoIpn));

// POST /api/MomoPayment/confirm -> browser-redirect fallback for local dev, where MoMo's
// IPN can't reach localhost. Same verification + finalize logic as the IPN handler, just
// triggered by the user's own browser landing on the redirect page instead of MoMo's servers.
router.post('/MomoPayment/confirm', requireAuth, asyncHandler(bookingController.momoConfirm));

// GET /api/my-invoices -> booking history for the caller, joined with ticket/schedule/movie details
router.get('/my-invoices', requireAuth, asyncHandler(bookingController.myInvoices));

// POST /api/invoice/:id/cancel -> cancels a booking if the showtime is more than 2h away (auth required)
router.post('/invoice/:id/cancel', requireAuth, asyncHandler(bookingController.cancelInvoice));

// GET /api/admin/invoices -> all transactions system-wide, newest first (booking.admin permission — super admin only)
router.get('/admin/invoices', requireAuth, requirePermission('booking.admin'), asyncHandler(bookingController.adminInvoices));

// POST /api/invoice/:id/refund -> marks a transaction refunded and reopens the seat (booking.admin permission)
router.post('/invoice/:id/refund', requireAuth, requirePermission('booking.admin'), asyncHandler(bookingController.refundInvoice));

// GET /api/invoice/lookup/:code -> booking detail for check-in (ticket.checkin permission, cinema-scoped
// via the controller's own canAccessCinema check)
router.get(
  '/invoice/lookup/:code',
  requireAuth,
  requirePermission('ticket.checkin'),
  asyncHandler(bookingController.lookupInvoice),
);

// POST /api/invoice/:id/checkin -> door check-in (ticket.checkin permission, cinema-scoped)
router.post(
  '/invoice/:id/checkin',
  requireAuth,
  requirePermission('ticket.checkin'),
  requireCinemaAccess((req) => bookingRepository.findCinemaIdByInvoiceId(req.params.id)),
  asyncHandler(bookingController.checkInInvoice),
);

// POST /api/invoice/counter-sale { ticketIds, comboIds, voucherCode, discountAmount, totalPrice, accountId, cinema_id }
// -> in-person cash/POS sale (booking.create permission, cinema-scoped)
router.post(
  '/invoice/counter-sale',
  requireAuth,
  requirePermission('booking.create'),
  requireCinemaAccess((req) => Number(req.body.cinema_id)),
  asyncHandler(bookingController.createCounterSale),
);

module.exports = router;
