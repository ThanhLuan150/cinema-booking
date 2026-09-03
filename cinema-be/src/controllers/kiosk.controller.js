const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Kiosk = require('../models/Kiosk');
const Account = require('../models/Account');
const Payment = require('../models/Payment');
const kioskRepository = require('../repositories/kiosk.repository');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const branchRepository = require('../repositories/branch.repository');
const comboRepository = require('../repositories/combo.repository');
const nextId = require('../utils/nextId');
const { generateKioskKey, hashKioskKey } = require('../utils/kioskKey');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');
const systemConfigService = require('../services/systemConfig.service');

const STATUSES = Kiosk.STATUSES;
const CHANNEL = 'KIOSK';
const CONFIRM_OUTCOMES = ['SUCCESS', 'FAILURE'];
const KIOSK_PAYMENT_METHODS = [Payment.METHOD.CARD, Payment.METHOD.QR_PAYMENT];

// ---------------------------------------------------------------------------
// Admin CRUD (JWT + kiosk.* permission + requireBranchAccess). Mirrors device.controller.
// ---------------------------------------------------------------------------

// The hidden Account every Booking / Payment / Invoice this kiosk produces is attributed to.
// The kiosk is unattended and the customer never signs in, so a per-kiosk guest account is
// what lets the kiosk reuse the normal (account-scoped) booking + seat-lock code paths.
async function createGuestAccount(kioskId, kioskCode) {
  const id = await nextId('account');
  const randomSecret = crypto.randomBytes(32).toString('hex');
  return Account.create({
    id,
    email: `kiosk-${kioskId}@kiosk.local`,
    password: await bcrypt.hash(randomSecret, 10),
    name: `Kiosk ${kioskCode}`,
    role: 1, // CUSTOMER
    status: 1,
    approved: true,
    verified: true,
  });
}

// GET /api/kiosks?branchId=&status=&page=&limit= (kiosk.read, branch-scoped)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await kioskRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/kiosks/:id (kiosk.read, branch-scoped)
async function getById(req, res) {
  const kiosk = await kioskRepository.findById(req.params.id);
  if (!kiosk) return res.status(404).json({ message: 'Kiosk not found' });
  res.json(kiosk);
}

// POST /api/kiosks { branch_id, kiosk_code, name, status? } (kiosk.create, branch-scoped).
// Returns the generated api_key exactly once — it is never retrievable later.
async function create(req, res) {
  const branch_id = req.branchId;
  const kiosk_code = req.body.kiosk_code ? String(req.body.kiosk_code).trim() : '';
  const name = req.body.name ? String(req.body.name).trim() : '';
  if (!kiosk_code || !name) return res.status(400).json({ message: 'kiosk_code and name are required' });

  if (await kioskRepository.findByKioskCode(kiosk_code)) {
    return res.status(409).json({ message: 'A kiosk with this kiosk_code already exists', code: 'KIOSK_CODE_TAKEN' });
  }

  let status = 'ACTIVE';
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    status = req.body.status;
  }

  const apiKey = generateKioskKey();
  const id = await nextId('kiosk');
  const guest = await createGuestAccount(id, kiosk_code);
  const kiosk = await kioskRepository.create({
    id,
    kiosk_code,
    name,
    branch_id,
    guest_account_id: guest.id,
    status,
    api_key_hash: hashKioskKey(apiKey),
  });

  res.status(201).json({ ...kiosk.toJSON(), api_key: apiKey });
}

// PUT /api/kiosks/:id { name?, status? } (kiosk.update, branch-scoped). The branch, kiosk_code
// and guest account are immutable — replace a unit by deleting and re-registering it.
async function update(req, res) {
  const kiosk = await kioskRepository.findById(req.params.id);
  if (!kiosk) return res.status(404).json({ message: 'Kiosk not found' });

  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    updates.status = req.body.status;
  }

  const updated = await kioskRepository.updateFields(kiosk.id, updates);
  res.json(updated);
}

// POST /api/kiosks/:id/rotate-key (kiosk.update, branch-scoped) — invalidates the old key and
// returns a fresh one once.
async function rotateKey(req, res) {
  const kiosk = await kioskRepository.findById(req.params.id);
  if (!kiosk) return res.status(404).json({ message: 'Kiosk not found' });

  const apiKey = generateKioskKey();
  await kioskRepository.updateFields(kiosk.id, { api_key_hash: hashKioskKey(apiKey) });
  res.json({ api_key: apiKey });
}

// DELETE /api/kiosks/:id (kiosk.delete, branch-scoped). The guest Account is left in place so
// the kiosk's historical bookings stay resolvable.
async function remove(req, res) {
  const kiosk = await kioskRepository.findById(req.params.id);
  if (!kiosk) return res.status(404).json({ message: 'Kiosk not found' });
  await kioskRepository.remove(kiosk.id);
  res.json({ message: 'Deleted' });
}

// ---------------------------------------------------------------------------
// Kiosk-authenticated self-service flow (X-Kiosk-Key -> req.kiosk). Every step is scoped to
// req.kiosk.branch_id, and every step reuses the existing seat-lock / pricing / booking /
// payment / ticket code paths — no kiosk-specific business logic.
// ---------------------------------------------------------------------------

function today() {
  return new Date().toISOString().split('T')[0];
}

// Loads a schedule and enforces the Ticket 31 security rule: a kiosk may only act on showtimes
// at the branch it is registered to. Returns { schedule } or writes the response and returns
// { handled: true }.
async function loadBranchSchedule(req, res, scheduleId) {
  const schedule = await bookingRepository.findScheduleById(scheduleId);
  if (!schedule) {
    res.status(404).json({ message: 'Showtime not found', code: 'SCHEDULE_NOT_FOUND' });
    return { handled: true };
  }
  if ((schedule.cinema_id ?? null) !== req.kiosk.branch_id) {
    res.status(403).json({ message: 'This kiosk cannot operate on another branch', code: 'KIOSK_BRANCH_MISMATCH' });
    return { handled: true };
  }
  return { schedule };
}

// GET /api/kiosks/session -> bootstrap: which kiosk / branch is this, and is it still ACTIVE.
async function session(req, res) {
  const branch = await branchRepository.findById(req.kiosk.branch_id);
  res.json({
    kiosk: {
      id: req.kiosk.id,
      kiosk_code: req.kiosk.kiosk_code,
      name: req.kiosk.name,
      status: req.kiosk.status,
      branch_id: req.kiosk.branch_id,
    },
    branch: branch ? { id: branch.id, name: branch.name, address: branch.address ?? null } : null,
  });
}

// GET /api/kiosks/movies -> movies with an upcoming showtime at this kiosk's branch.
async function listMovies(req, res) {
  const movies = await bookingRepository.findBranchMoviesPlaying(req.kiosk.branch_id, today());
  res.json(movies.map((m) => m.toJSON()));
}

// GET /api/kiosks/combos -> the active combos on sale at this kiosk's branch.
async function listCombos(req, res) {
  const { data } = await comboRepository.findActiveByCinemaId(req.kiosk.branch_id, { limit: 200 });
  res.json(data.map((c) => c.toJSON()));
}

// GET /api/kiosks/movies/:movieId/showtimes -> upcoming showtimes for that movie, at this
// kiosk's branch only.
async function listShowtimes(req, res) {
  const schedules = await bookingRepository.findUpcomingSchedulesForMovie(req.params.movieId, today());
  const branchSchedules = schedules.filter((s) => (s.cinema_id ?? null) === req.kiosk.branch_id);
  res.json(
    branchSchedules.map((s) => ({
      id: s.id,
      movie_id: s.movie_id,
      room_id: s.room_id,
      movie_date: s.movie_date,
      time_begin: s.time_begin,
      time_end: s.time_end,
      price: s.price,
      status: s.status,
    })),
  );
}

// GET /api/kiosks/showtimes/:scheduleId/seats -> the seat grid, exactly as booking.controller
// .bookseat builds it, with prices resolved through the shared pricing engine.
async function listSeats(req, res) {
  const { schedule, handled } = await loadBranchSchedule(req, res, req.params.scheduleId);
  if (handled) return;

  await bookingRepository.expireHeldTickets(schedule.id);
  const tickets = await bookingRepository.findTicketsByScheduleId(schedule.id);
  const priceByTicketId = await bookingRepository.calculateTicketPrices(schedule, tickets, req.kiosk.guest_account_id);

  res.json(
    tickets.map((t) => ({
      id: t.id,
      seat_code: t.seat_code,
      seat_type: t.seat_type,
      status: t.status,
      held_by_me: t.status === 2 && t.held_by === req.kiosk.guest_account_id,
      price: priceByTicketId.get(t.id)?.price ?? null,
    })),
  );
}

// POST /api/kiosks/showtimes/:scheduleId/hold { seatCodes } -> reserves seats for this kiosk's
// guest account. A BOOKED seat can never be held here (holdTickets only matches AVAILABLE /
// already-held-by-me), so "Không cho chọn Seat đã BOOKED" is enforced by reuse.
async function holdSeats(req, res) {
  const { seatCodes } = req.body;
  if (!Array.isArray(seatCodes) || seatCodes.length === 0) {
    return res.status(400).json({ message: 'seatCodes is required' });
  }

  const { schedule, handled } = await loadBranchSchedule(req, res, req.params.scheduleId);
  if (handled) return;
  if (schedule.status === 'CANCELLED') {
    return res.status(400).json({ message: 'This showtime has been cancelled', code: 'SCHEDULE_CANCELLED' });
  }

  const branchId = schedule.cinema_id ?? null;
  const maxSeats = await systemConfigService.getValue('MAX_BOOKING_SEATS', branchId);
  if (seatCodes.length > maxSeats) {
    return res.status(400).json({
      message: `A booking cannot hold more than ${maxSeats} seat(s) at once`,
      code: 'MAX_BOOKING_SEATS_EXCEEDED',
    });
  }

  await bookingRepository.expireHeldTickets(schedule.id);
  const holdMinutes = await systemConfigService.getValue('BOOKING_HOLD_TIME', branchId);
  const heldUntil = new Date(Date.now() + holdMinutes * 60 * 1000);
  const accountId = req.kiosk.guest_account_id;
  const tickets = await bookingRepository.holdTickets({
    scheduleId: schedule.id,
    seatCodes,
    accountId,
    until: heldUntil,
  });

  const ticketBySeatCode = new Map(tickets.map((t) => [t.seat_code, t]));
  const conflicts = [];
  const held = [];
  for (const seatCode of seatCodes) {
    const ticket = ticketBySeatCode.get(seatCode);
    if (ticket && ticket.status === 2 && ticket.held_by === accountId) {
      held.push({ id: ticket.id, seat_code: ticket.seat_code, status: ticket.status });
    } else {
      conflicts.push(seatCode);
    }
  }

  if (conflicts.length > 0) {
    return res
      .status(409)
      .json({ message: 'One or more seats are no longer available', code: 'SEAT_UNAVAILABLE', seatCodes: conflicts });
  }
  res.json({ held, held_until: heldUntil });
}

// POST /api/kiosks/showtimes/:scheduleId/release { seatCodes } -> releases this kiosk's own holds.
async function releaseSeats(req, res) {
  const { seatCodes } = req.body;
  if (!Array.isArray(seatCodes) || seatCodes.length === 0) {
    return res.status(400).json({ message: 'seatCodes is required' });
  }

  const { schedule, handled } = await loadBranchSchedule(req, res, req.params.scheduleId);
  if (handled) return;

  await bookingRepository.releaseTickets({
    scheduleId: schedule.id,
    seatCodes,
    accountId: req.kiosk.guest_account_id,
  });
  res.json({ released: seatCodes });
}

// Shared: recompute the authoritative order pricing. The client never sends a price — anything
// price-like in the request body is ignored ("Không cho tự thay đổi giá").
async function priceKioskOrder(req, body) {
  const { ticketIds, comboIds, voucherCode, promotionCode } = body;
  return bookingRepository.computeOrderPricing({
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: voucherCode || null,
    promotionCode: promotionCode || null,
    accountId: req.kiosk.guest_account_id,
  });
}

// POST /api/kiosks/quote { scheduleId, ticketIds, comboIds, voucherCode, promotionCode }
// -> server-authoritative pricing breakdown for the review screen.
async function quote(req, res) {
  const { ticketIds, voucherCode, promotionCode } = req.body;
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'ticketIds is required' });
  }
  if (voucherCode && promotionCode) {
    return res.status(400).json({
      message: 'Cannot apply both a voucher and a promotion to the same order',
      code: 'DISCOUNT_CONFLICT',
    });
  }

  const pricing = await priceKioskOrder(req, req.body);
  if (!pricing) return res.status(400).json({ message: 'Unable to price this order', code: 'PRICING_FAILED' });

  const schedule = await bookingRepository.findScheduleById(pricing.scheduleId);
  if (!schedule || (schedule.cinema_id ?? null) !== req.kiosk.branch_id) {
    return res.status(403).json({ message: 'This kiosk cannot operate on another branch', code: 'KIOSK_BRANCH_MISMATCH' });
  }

  res.json({
    seatTotal: pricing.seatTotal,
    comboTotal: pricing.comboTotal,
    discountAmount: pricing.discountAmount,
    totalPrice: pricing.totalPrice,
    voucherCode: pricing.voucherCode,
    promotionCode: pricing.promotionCode,
  });
}

// POST /api/kiosks/checkout { scheduleId, ticketIds, comboIds, voucherCode, promotionCode }
// -> creates a PENDING Booking + PENDING Payment. No ticket is issued here: that only happens
// in /checkout/:code/confirm once payment has actually cleared.
async function checkout(req, res) {
  const { ticketIds, comboIds, voucherCode, promotionCode } = req.body;
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'ticketIds is required' });
  }
  if (voucherCode && promotionCode) {
    return res.status(400).json({
      message: 'Cannot apply both a voucher and a promotion to the same order',
      code: 'DISCOUNT_CONFLICT',
    });
  }

  // Idempotency short-circuit: a retry with the same key echoes back the original order rather
  // than double-booking. The client mints a fresh key whenever the order itself changes (seats
  // / combos / codes), so a failed attempt's released seats are re-held under a new key.
  const idempotencyKey = req.headers?.['idempotency-key'] || null;
  if (idempotencyKey) {
    const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return res.status(200).json({
        code: existing.code,
        bookingId: existing.booking_id,
        amount: existing.amount,
        alreadyProcessed: true,
      });
    }
  }

  const accountId = req.kiosk.guest_account_id;
  const branchId = req.kiosk.branch_id;

  // Every seat must be currently HELD by this kiosk — not BOOKED, not held by anyone else.
  const tickets = await bookingRepository.findTicketsByIds(ticketIds.map(Number));
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const notLocked = ticketIds.filter((id) => {
    const t = ticketById.get(Number(id));
    return !t || t.status !== 2 || t.held_by !== accountId;
  });
  if (notLocked.length > 0) {
    return res.status(409).json({
      message: 'One or more seats are not held by this kiosk — hold the seats before paying',
      code: 'SEAT_NOT_LOCKED',
      ticketIds: notLocked,
    });
  }

  const scheduleId = tickets[0].schedule_id;
  const schedule = await bookingRepository.findScheduleById(scheduleId);
  if (!schedule || (schedule.cinema_id ?? null) !== branchId) {
    return res.status(403).json({ message: 'This kiosk cannot operate on another branch', code: 'KIOSK_BRANCH_MISMATCH' });
  }
  if (schedule.status === 'CANCELLED') {
    return res.status(400).json({ message: 'This showtime has been cancelled', code: 'SCHEDULE_CANCELLED' });
  }

  const pricing = await priceKioskOrder(req, req.body);
  if (!pricing) return res.status(400).json({ message: 'Unable to price this order', code: 'PRICING_FAILED' });

  // Re-extend the hold to cover the payment window; this same instant is the booking's
  // expires_at, so an abandoned checkout is swept by expireStalePendingBookings.
  const holdMinutes = await systemConfigService.getValue('BOOKING_HOLD_TIME', branchId);
  const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
  await bookingRepository.holdTickets({
    scheduleId,
    seatCodes: tickets.map((t) => t.seat_code),
    accountId,
    until: expiresAt,
  });

  const code = `KIO-${await nextId('kioskOrder')}`;
  const booking = await bookingRepository.createPendingBooking({
    code,
    accountId,
    scheduleId,
    branchId,
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: pricing.voucherCode,
    promotionCode: pricing.promotionCode,
    discountAmount: pricing.discountAmount,
    seatTotal: pricing.seatTotal,
    comboTotal: pricing.comboTotal,
    totalPrice: pricing.totalPrice,
    expiresAt,
  });

  await paymentRepository.createPayment({
    code,
    bookingId: booking.id,
    accountId,
    branchId,
    type: Payment.TYPE.KIOSK,
    method: Payment.METHOD.CARD,
    amount: pricing.totalPrice,
    status: Payment.STATUS.PENDING,
    idempotencyKey,
  });

  await recordAudit({
    performedBy: null,
    action: ACTION.CREATE_BOOKING,
    entityType: ENTITY_TYPE.BOOKING,
    entityId: booking.id,
    branchId,
    metadata: { code, channel: CHANNEL, seats: ticketIds.length, totalPrice: pricing.totalPrice, kiosk_id: req.kiosk.id },
  });

  res.status(201).json({ code, bookingId: booking.id, amount: pricing.totalPrice, expiresAt });
}

// POST /api/kiosks/checkout/:code/confirm { outcome: 'SUCCESS'|'FAILURE', method?, gatewayRef? }
// -> the result the kiosk's integrated card / QR terminal reports back.
//   FAILURE -> Payment FAILED, Booking not PAID, seats released.
//   SUCCESS -> Payment PAID, then the shared finalize path issues the tickets + QR.
async function confirmPayment(req, res) {
  const { outcome, method, gatewayRef } = req.body || {};
  if (!CONFIRM_OUTCOMES.includes(outcome)) {
    return res.status(400).json({ message: "outcome must be 'SUCCESS' or 'FAILURE'", code: 'INVALID_OUTCOME' });
  }
  const paymentMethod = method && KIOSK_PAYMENT_METHODS.includes(method) ? method : Payment.METHOD.CARD;

  const payment = await paymentRepository.findByCode(req.params.code);
  if (!payment || payment.type !== Payment.TYPE.KIOSK) {
    return res.status(404).json({ message: 'Kiosk payment not found', code: 'PAYMENT_NOT_FOUND' });
  }
  if ((payment.branch_id ?? null) !== req.kiosk.branch_id) {
    return res.status(403).json({ message: 'This kiosk cannot operate on another branch', code: 'KIOSK_BRANCH_MISMATCH' });
  }

  const booking = await bookingRepository.findBookingById(payment.booking_id);
  if (!booking) return res.status(404).json({ message: 'Booking not found', code: 'BOOKING_NOT_FOUND' });

  if (payment.status === Payment.STATUS.PAID) {
    return res.status(200).json({ paid: true, code: payment.code, bookingId: payment.booking_id, alreadyProcessed: true });
  }
  if (payment.status === Payment.STATUS.FAILED) {
    return res.status(200).json({ paid: false, code: payment.code, reason: payment.failure_reason, alreadyProcessed: true });
  }

  if (outcome === 'FAILURE') {
    await paymentRepository.markFailedIfPending(payment.code, gatewayRef ? `Kiosk terminal declined (${gatewayRef})` : 'Kiosk terminal declined');
    if (booking && Array.isArray(booking.ticket_ids) && booking.ticket_ids.length > 0) {
      await bookingRepository.timeoutTicketsByIds(booking.ticket_ids);
    }
    await bookingRepository.cancelPendingBookingByCode(payment.code);
    await recordAudit({
      performedBy: null,
      action: ACTION.PAYMENT_FAILED,
      entityType: ENTITY_TYPE.PAYMENT,
      entityId: payment.id,
      branchId: payment.branch_id ?? null,
      metadata: { code: payment.code, channel: CHANNEL, kiosk_id: req.kiosk.id },
    });
    return res.status(200).json({ paid: false, code: payment.code, reason: 'PAYMENT_FAILED' });
  }

  // SUCCESS. If the hold lapsed and the sweep already EXPIRED this booking (its seats are gone,
  // possibly resold), we must not issue tickets against it — the terminal took the money, so
  // flag the payment for a manual refund rather than double-booking the seats.
  if (booking.status !== 'PENDING') {
    await paymentRepository.markPaidIfPending(payment.code, {
      gatewayTransactionId: gatewayRef ? String(gatewayRef) : null,
    });
    const refreshed = await paymentRepository.findByCode(payment.code);
    if (refreshed && refreshed.status === Payment.STATUS.PAID) {
      await paymentRepository.requestRefund(refreshed.id, 'Kiosk hold expired before payment confirmed');
    }
    await recordAudit({
      performedBy: null,
      action: ACTION.PAYMENT_FAILED,
      entityType: ENTITY_TYPE.PAYMENT,
      entityId: payment.id,
      branchId: payment.branch_id ?? null,
      metadata: { code: payment.code, channel: CHANNEL, reason: 'HOLD_EXPIRED', kiosk_id: req.kiosk.id },
    });
    return res.status(409).json({
      paid: true,
      needsRefund: true,
      code: payment.code,
      reason: 'BOOKING_EXPIRED',
      message: 'Your seat hold expired before payment completed — please see staff for a refund',
    });
  }

  const { skip } = await paymentRepository.markPaidIfPending(payment.code, {
    gatewayTransactionId: gatewayRef ? String(gatewayRef) : null,
  });
  if (!skip) {
    await bookingRepository.finalizeMomoOrder(
      payment.code,
      {
        ticketIds: booking.ticket_ids,
        comboIds: booking.combo_ids,
        voucherCode: booking.voucher_code,
        promotionCode: booking.promotion_code,
        discountAmount: booking.discount_amount,
        totalPrice: booking.total_price,
        seatTotal: booking.seat_total,
        comboTotal: booking.combo_total,
        accountId: booking.account_id,
      },
      { comboPaymentMethod: paymentMethod },
    );
    await recordAudit({
      performedBy: null,
      action: ACTION.PAYMENT_SUCCESS,
      entityType: ENTITY_TYPE.PAYMENT,
      entityId: payment.id,
      branchId: payment.branch_id ?? null,
      metadata: { code: payment.code, channel: CHANNEL, method: paymentMethod, amount: payment.amount, kiosk_id: req.kiosk.id },
    });
    await recordAudit({
      performedBy: null,
      action: ACTION.TICKET_ISSUED,
      entityType: ENTITY_TYPE.TICKET,
      entityId: payment.booking_id,
      branchId: payment.branch_id ?? null,
      metadata: { code: payment.code, channel: CHANNEL, count: booking.ticket_ids.length, kiosk_id: req.kiosk.id },
    });
  }

  res.status(201).json({ paid: true, code: payment.code, bookingId: payment.booking_id });
}

// GET /api/kiosks/bookings/:code/tickets -> the issued tickets (seat + QR + movie/showtime)
// for a PAID kiosk booking, for the "Display QR / Print Ticket" screen.
async function bookingTickets(req, res) {
  const payment = await paymentRepository.findByCode(req.params.code);
  if (!payment || payment.type !== Payment.TYPE.KIOSK) {
    return res.status(404).json({ message: 'Kiosk booking not found', code: 'BOOKING_NOT_FOUND' });
  }
  if ((payment.branch_id ?? null) !== req.kiosk.branch_id) {
    return res.status(403).json({ message: 'This kiosk cannot operate on another branch', code: 'KIOSK_BRANCH_MISMATCH' });
  }

  const booking = await bookingRepository.findBookingById(payment.booking_id);
  if (!booking) return res.status(404).json({ message: 'Booking not found', code: 'BOOKING_NOT_FOUND' });
  if (booking.status !== 'PAID') {
    return res.status(409).json({ message: 'This booking has not been paid', code: 'BOOKING_NOT_PAID' });
  }

  const tickets = await bookingRepository.findTicketViewsForBooking(booking.id);
  res.json({ booking: { id: booking.id, code: booking.code, total_price: booking.total_price }, tickets });
}

module.exports = {
  list,
  getById,
  create,
  update,
  rotateKey,
  remove,
  session,
  listMovies,
  listCombos,
  listShowtimes,
  listSeats,
  holdSeats,
  releaseSeats,
  quote,
  checkout,
  confirmPayment,
  bookingTickets,
};
