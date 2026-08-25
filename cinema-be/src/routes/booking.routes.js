const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const bookingRepository = require('../repositories/booking.repository');
const bookingController = require('../controllers/booking.controller');

const router = express.Router();

// POST /api/scheduleId { movie_id, movie_date, time_begin } -> { id } (auth required)
router.post('/scheduleId', requireAuth, asyncHandler(bookingController.resolveScheduleId));

// GET /api/bookseat/:scheduleId -> seat grid for that schedule (auth required)
router.get('/bookseat/:scheduleId', requireAuth, asyncHandler(bookingController.bookseat));

// POST /api/bookseat/:scheduleId/hold { seatCodes } -> reserves seats for the caller (auth required)
router.post('/bookseat/:scheduleId/hold', requireAuth, asyncHandler(bookingController.holdSeats));

// POST /api/bookseat/:scheduleId/release { seatCodes } -> releases the caller's own held seats (auth required)
router.post('/bookseat/:scheduleId/release', requireAuth, asyncHandler(bookingController.releaseSeats));

// GET /api/bookticket/:movieId -> schedules for a movie, grouped by date (auth required)
router.get('/bookticket/:movieId', requireAuth, asyncHandler(bookingController.bookticket));

// POST /api/MomoPayment { ticketIds, comboIds, voucherCode, discountAmount, totalPrice }
router.post('/MomoPayment', requireAuth, requirePermission('payment.create'), asyncHandler(bookingController.createMomoPayment));

router.post('/MomoPayment/ipn', asyncHandler(bookingController.momoIpn));

// POST /api/MomoPayment/confirm -> browser-redirect fallback for local dev, where MoMo's
// IPN can't reach localhost. Same verification + finalize logic as the IPN handler, just
// triggered by the user's own browser landing on the redirect page instead of MoMo's servers.
router.post('/MomoPayment/confirm', requireAuth, asyncHandler(bookingController.momoConfirm));

// GET /api/my-invoices -> booking history for the caller, joined with ticket/schedule/movie details
router.get('/my-invoices', requireAuth, requirePermission('booking.read'), asyncHandler(bookingController.myInvoices));

// GET /api/my-tickets -> the caller's issued tickets (one per seat), newest first, with QR/status
router.get('/my-tickets', requireAuth, requirePermission('booking.read'), asyncHandler(bookingController.myTickets));

// GET /api/my-tickets/:id -> single ticket detail: movie, showtime, room, seat, QR token, status
router.get(
  '/my-tickets/:id',
  requireAuth,
  requirePermission('booking.read'),
  asyncHandler(bookingController.getTicketById),
);

// POST /api/tickets/verify { qr_token } -> door staff scan a ticket's QR to look it up
// (ticket.checkin permission, cinema-scoped via the controller's own canAccessCinema check)
router.post(
  '/tickets/verify',
  requireAuth,
  requirePermission('ticket.checkin'),
  asyncHandler(bookingController.verifyTicketByQr),
);

// POST /api/invoice/:id/cancel -> cancels a single ticket's invoice if the showtime is
// more than 2h away
router.post(
  '/invoice/:id/cancel',
  requireAuth,
  requirePermission('booking.cancel'),
  asyncHandler(bookingController.cancelInvoice),
);

// GET /api/bookings -> bookings visible to the caller, scoped by booking.read's OWN/BRANCH/ALL
router.get('/bookings', requireAuth, requirePermission('booking.read'), asyncHandler(bookingController.listBookings));

// GET /api/bookings/:id -> booking detail (same scope check as the list)
router.get(
  '/bookings/:id',
  requireAuth,
  requirePermission('booking.read'),
  asyncHandler(bookingController.getBookingById),
);

// POST /api/bookings/:id/cancel -> cancels the whole booking (all seats/combos), releasing seats
router.post(
  '/bookings/:id/cancel',
  requireAuth,
  requirePermission('booking.cancel'),
  asyncHandler(bookingController.cancelBooking),
);

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
  requireBranchAccess((req) => bookingRepository.findCinemaIdByInvoiceId(req.params.id)),
  asyncHandler(bookingController.checkInInvoice),
);

router.post(
  '/invoice/counter-sale',
  requireAuth,
  requirePermission('booking.create'),
  requirePermission('payment.create'),
  requireBranchAccess((req) => Number(req.body.cinema_id)),
  asyncHandler(bookingController.createCounterSale),
);

module.exports = router;
