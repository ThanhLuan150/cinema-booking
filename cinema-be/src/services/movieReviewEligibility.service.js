const Booking = require('../models/Booking');
const Schedule = require('../models/Schedule');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const paymentRepository = require('../repositories/payment.repository');

// Ticket 33 business rule: Customer -> Booking -> Payment PAID -> Ticket USED -> Review.
// A booking counts as "paid" once it reaches PAID or COMPLETED (COMPLETED is set once every
// sibling invoice has been checked in, so it's still a fully-paid booking).
const PAID_BOOKING_STATUSES = [Booking.STATUS.PAID, Booking.STATUS.COMPLETED];

// Mirrors the same "was this actually paid" double-check refund.controller.js does before
// requestRefund: Booking.status is normally set in lockstep with the linked Payment (same
// order-completion flow), but the ticket spec calls out Payment=PAID as its own explicit step,
// so this reads the Payment record itself rather than trusting Booking.status alone.
async function isActuallyPaid(booking) {
  const payment = await paymentRepository.findByCode(booking.code);
  return Boolean(payment) && payment.status === Payment.STATUS.PAID;
}

// Checks whether `accountId` may post a verified-purchase review of `movieId` using `bookingId`.
// Returns { ok: true, booking } or { ok: false, status, code, message }.
async function checkEligibility({ accountId, movieId, bookingId }) {
  const booking = await Booking.findOne({ id: Number(bookingId) });
  if (!booking) {
    return { ok: false, status: 404, code: 'BOOKING_NOT_FOUND', message: 'Booking not found' };
  }
  if (booking.account_id !== accountId) {
    return { ok: false, status: 403, code: 'BOOKING_NOT_OWNED', message: 'This booking does not belong to you' };
  }

  const schedule = await Schedule.findOne({ id: booking.schedule_id });
  if (!schedule || schedule.movie_id !== Number(movieId)) {
    return {
      ok: false,
      status: 400,
      code: 'BOOKING_MOVIE_MISMATCH',
      message: 'This booking is not for the movie being reviewed',
    };
  }

  if (!PAID_BOOKING_STATUSES.includes(booking.status) || !(await isActuallyPaid(booking))) {
    return {
      ok: false,
      status: 403,
      code: 'PAYMENT_NOT_CONFIRMED',
      message: 'This booking has not been paid for',
    };
  }

  const usedInvoice = await Invoice.findOne({ booking_id: booking.id, ticket_status: Invoice.TICKET_STATUS.USED });
  if (!usedInvoice) {
    return {
      ok: false,
      status: 403,
      code: 'TICKET_NOT_USED',
      message: 'You can only review a movie after your ticket has been checked in',
    };
  }

  return { ok: true, booking };
}

// Bookings for `accountId`+`movieId` that satisfy the paid+used-ticket rule above, regardless of
// whether they've already been reviewed — used by the "which of my bookings can I review" UI.
async function findEligibleBookings(accountId, movieId) {
  const schedules = await Schedule.find({ movie_id: Number(movieId) }, 'id');
  const scheduleIds = schedules.map((s) => s.id);
  if (scheduleIds.length === 0) return [];

  const bookings = await Booking.find({
    account_id: accountId,
    schedule_id: { $in: scheduleIds },
    status: { $in: PAID_BOOKING_STATUSES },
  });
  if (bookings.length === 0) return [];

  const usedInvoices = await Invoice.find({
    booking_id: { $in: bookings.map((b) => b.id) },
    ticket_status: Invoice.TICKET_STATUS.USED,
  });
  const bookingIdsWithUsedTicket = new Set(usedInvoices.map((i) => i.booking_id));
  const candidates = bookings.filter((b) => bookingIdsWithUsedTicket.has(b.id));

  const paidFlags = await Promise.all(candidates.map((b) => isActuallyPaid(b)));
  return candidates.filter((_, i) => paidFlags[i]);
}

module.exports = { checkEligibility, findEligibleBookings, PAID_BOOKING_STATUSES };
