const Payment = require('../models/Payment');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const boxOfficeRepository = require('../repositories/boxOffice.repository');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');
const notificationService = require('../services/notification.service');
const cashierShiftService = require('../services/cashierShift.service');

const PAYMENT_METHODS = [Payment.METHOD.CASH, Payment.METHOD.CARD, Payment.METHOD.QR_PAYMENT];
const CHANNEL = 'BOX_OFFICE';

// POST /api/box-office/sell { scheduleId, ticketIds, comboIds, voucherCode, promotionCode,
// accountId, method, cinema_id } -> the counter-sale endpoint behind Box Office / POS: sells
// seats the calling employee has already locked (bookseat/:id/hold), reusing Booking / Seat
// Lock / Pricing / Combo / Payment exactly as the rest of the app does. Booking always ends up
// PAID (or the request is rejected outright) — there is no partial/pending Box Office sale.
async function sellTickets(req, res) {
  const { scheduleId, ticketIds, comboIds, voucherCode, promotionCode, accountId, method } = req.body;

  if (!scheduleId || !Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'scheduleId and ticketIds are required' });
  }
  if (!accountId) {
    return res.status(400).json({ message: 'accountId is required' });
  }
  if (voucherCode && promotionCode) {
    return res.status(400).json({
      message: 'Cannot apply both a voucher and a promotion to the same order',
      code: 'DISCOUNT_CONFLICT',
    });
  }
  const paymentMethod = method || Payment.METHOD.CASH;
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: `method must be one of ${PAYMENT_METHODS.join(', ')}`, code: 'INVALID_METHOD' });
  }

  // Idempotency short-circuit *before* re-checking the seat lock: on a retry, the first attempt
  // already sold the seats (they're BOOKED now, no longer HELD), so re-validating the lock here
  // would wrongly reject a legitimate retry of an already-successful sale.
  const idempotencyKey = req.headers?.['idempotency-key'] || null;
  if (idempotencyKey) {
    const existingPayment = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existingPayment) {
      return res.status(200).json({
        bookingId: existingPayment.booking_id,
        code: existingPayment.code,
        totalPrice: existingPayment.amount,
        alreadyProcessed: true,
      });
    }
  }

  const { tickets, invalid } = await boxOfficeRepository.verifyTicketsLockedByEmployee({
    scheduleId,
    ticketIds,
    employeeAccountId: req.account.accountId,
  });
  if (invalid.length > 0) {
    return res.status(409).json({
      message: 'One or more seats are not locked by you — hold the seats before completing payment',
      code: 'SEAT_NOT_LOCKED',
      ticketIds: invalid,
    });
  }

  const schedule = await bookingRepository.findScheduleById(scheduleId);
  if (schedule && schedule.status === 'CANCELLED') {
    return res.status(400).json({ message: 'This showtime has been cancelled', code: 'SCHEDULE_CANCELLED' });
  }

  for (const ticket of tickets) {
    const ticketBranchId = await bookingRepository.findCinemaIdByTicketId(ticket.id);
    if (ticketBranchId !== req.branchId) {
      return res.status(400).json({ message: 'All tickets must belong to the target cinema', code: 'TICKET_CINEMA_MISMATCH' });
    }
  }

  // Backend recomputes the order total from scratch — the client's own numbers are never trusted.
  const pricing = await bookingRepository.computeOrderPricing({
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: voucherCode || null,
    promotionCode: promotionCode || null,
    accountId: Number(accountId),
  });
  if (!pricing) {
    return res.status(400).json({ message: 'Unable to price this order', code: 'PRICING_FAILED' });
  }

  const openShift = await cashierShiftService.getOpenShiftForAccount(req.account.accountId);

  const result = await boxOfficeRepository.sell({
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: pricing.voucherCode,
    promotionCode: pricing.promotionCode,
    discountAmount: pricing.discountAmount,
    seatTotal: pricing.seatTotal,
    comboTotal: pricing.comboTotal,
    totalPrice: pricing.totalPrice,
    accountId: Number(accountId),
    employeeId: req.account.accountId,
    branchId: req.branchId,
    method: paymentMethod,
    idempotencyKey,
    shiftId: openShift ? openShift.id : null,
  });

  if (result.skipped) {
    return res.status(400).json({ message: 'Invalid box office sale payload' });
  }

  if (result.bookingId && !result.alreadyProcessed) {
    await recordAudit({
      req,
      action: ACTION.CREATE_BOOKING,
      entityType: ENTITY_TYPE.BOOKING,
      entityId: result.bookingId,
      branchId: req.branchId ?? null,
      metadata: { channel: CHANNEL, seats: ticketIds.length, totalPrice: pricing.totalPrice },
    });
    await recordAudit({
      req,
      action: ACTION.PAYMENT_SUCCESS,
      entityType: ENTITY_TYPE.PAYMENT,
      entityId: result.bookingId,
      branchId: req.branchId ?? null,
      metadata: { channel: CHANNEL, method: paymentMethod, amount: pricing.totalPrice },
    });
    await recordAudit({
      req,
      action: ACTION.TICKET_ISSUED,
      entityType: ENTITY_TYPE.TICKET,
      entityId: result.bookingId,
      branchId: req.branchId ?? null,
      metadata: { channel: CHANNEL, count: ticketIds.length },
    });

    await notificationService.notify({
      event: notificationService.EVENT.BOOKING_CREATED,
      accountId: Number(accountId),
      bookingId: result.bookingId,
    });
    await notificationService.notify({
      event: notificationService.EVENT.PAYMENT_SUCCESS,
      accountId: Number(accountId),
      bookingId: result.bookingId,
      data: { amount: pricing.totalPrice, channel: CHANNEL },
    });
    await notificationService.notify({
      event: notificationService.EVENT.TICKET_ISSUED,
      accountId: Number(accountId),
      bookingId: result.bookingId,
    });
  }

  res.status(201).json({
    bookingId: result.bookingId,
    code: result.code,
    totalPrice: pricing.totalPrice,
    alreadyProcessed: Boolean(result.alreadyProcessed),
  });
}

// GET /api/box-office/bookings/:id/tickets -> reprint: every seat's ticket view for a PAID
// booking (ticket.create permission, scoped to the caller's own branch — the same branch a
// Box Office sale itself is restricted to).
async function getBookingTickets(req, res) {
  const booking = await bookingRepository.findBookingById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  if (req.permissionScope !== 'ALL') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    if (!branchIds.includes(booking.branch_id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  const tickets = await bookingRepository.findTicketViewsForBooking(booking.id);
  res.json({ booking, tickets });
}

module.exports = { sellTickets, getBookingTickets };
