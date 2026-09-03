const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const Account = require('../models/Account');
const Voucher = require('../models/Voucher');
const Promotion = require('../models/Promotion');
const promotionRepository = require('./promotion.repository');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Combo = require('../models/Combo');
const Payment = require('../models/Payment');
const paymentRepository = require('./payment.repository');
const comboOrderRepository = require('./comboOrder.repository');
const nextId = require('../utils/nextId');
const { generateQrToken } = require('../utils/qrToken');
const { sendInvoiceEmail } = require('../utils/mailer');
const { emitToOwner } = require('../utils/socket');
const pricingEngine = require('../services/pricingEngine');
const loyaltyService = require('../services/loyaltyService');
const { isVoucherEligible, computeVoucherDiscount } = require('../utils/voucherPricing');
const { isPromotionEligible, computePromotionDiscount } = require('../utils/promotionPricing');

async function findScheduleByMovieDateTime({ movie_id, movie_date, time_begin }) {
  return Schedule.findOne({ movie_id: Number(movie_id), movie_date, time_begin, status: { $ne: 'CANCELLED' } });
}

async function findTicketsByScheduleId(scheduleId) {
  return Ticket.find({ schedule_id: Number(scheduleId) }).sort({ seat_index: 1 });
}

// Customer-facing: only showtimes that are still active are bookable.
async function findUpcomingSchedulesForMovie(movieId, fromDate) {
  return Schedule.find({
    movie_id: Number(movieId),
    movie_date: { $gte: fromDate },
    status: { $ne: 'CANCELLED' },
  }).sort({
    movie_date: 1,
    time_begin: 1,
  });
}

// Groups a flat combo_ids list (one entry per unit) into a Combo Staff-visible ComboOrder,
// already PAID since the booking's own payment already covers it, so it shows up in the
// PREPARING/READY/DELIVERED queue for whoever bought combo alongside their tickets — not just
// combo sold standalone at the counter via POST /combo-orders. Ids that no longer resolve to a
// live Combo (e.g. deleted since) are silently dropped rather than failing the whole booking.
async function createLinkedComboOrder({ bookingId, branchId, accountId, comboIds, createdBy, paymentMethod }) {
  const quantityById = new Map();
  for (const id of comboIds) {
    const key = Number(id);
    quantityById.set(key, (quantityById.get(key) || 0) + 1);
  }

  const combos = await Combo.find({ id: { $in: [...quantityById.keys()] } });
  const comboById = new Map(combos.map((c) => [c.id, c]));
  const items = [...quantityById.entries()]
    .map(([id, quantity]) => {
      const combo = comboById.get(id);
      if (!combo) return null;
      return { combo_id: id, name: combo.name, unit_price: combo.price, quantity, line_total: combo.price * quantity };
    })
    .filter(Boolean);
  if (items.length === 0) return null;

  const totalPrice = items.reduce((sum, item) => sum + item.line_total, 0);
  const order = await comboOrderRepository.createOrder({
    branchId,
    accountId,
    bookingId,
    items,
    totalPrice,
    createdBy,
  });
  return comboOrderRepository.markPaid(order.id, paymentMethod);
}

// Creates the Invoice rows + marks tickets sold for a paid MoMo order. Idempotent on
// `orderId` (stored as Invoice.code) so a retried IPN call or a user landing on the
// redirect page twice never double-books.
async function finalizeMomoOrder(orderId, orderPayload, { comboPaymentMethod = null } = {}) {
  const existing = await Invoice.findOne({ code: orderId });
  if (existing) return { alreadyProcessed: true };

  const {
    ticketIds = [],
    comboIds = [],
    voucherCode,
    promotionCode,
    discountAmount = 0,
    totalPrice = 0,
    accountId,
    createdBy = null,
    seatTotal = 0,
    comboTotal = 0,
  } = orderPayload;
  if (!accountId || ticketIds.length === 0) return { alreadyProcessed: false, skipped: true };

  // A customer applies a voucher OR a promotion to an order, never both — enforced when the
  // order is first priced (computeOrderPricing) / created (booking.controller.js).
  if (voucherCode) {
    const voucher = await Voucher.findOne({ code: String(voucherCode).toUpperCase() });
    if (voucher) {
      await Voucher.updateOne({ id: voucher.id }, { $inc: { used_count: 1 } });
    }
  } else if (promotionCode) {
    const promotion = await Promotion.findOne({ code: String(promotionCode).toUpperCase() });
    if (promotion) {
      await promotionRepository.recordUsage(promotion.id, accountId);
    }
  }

  // Upsert the parent Booking: a PENDING one created by createMomoPayment gets flipped to
  // PAID here; a counter sale never had a PENDING phase, so it's created PAID directly.
  let booking = await Booking.findOne({ code: orderId });
  if (booking) {
    booking.status = Booking.STATUS.PAID;
    booking.paid_at = new Date();
    await booking.save();
  } else {
    const branchId = await findCinemaIdByTicketId(ticketIds[0]);
    const firstTicketForSchedule = await Ticket.findOne({ id: Number(ticketIds[0]) });
    booking = await Booking.create({
      id: await nextId('booking'),
      code: orderId,
      account_id: Number(accountId),
      schedule_id: firstTicketForSchedule ? firstTicketForSchedule.schedule_id : 0,
      branch_id: branchId ?? 0,
      ticket_ids: ticketIds.map(Number),
      combo_ids: comboIds.map(Number),
      voucher_code: voucherCode ? String(voucherCode).toUpperCase() : null,
      promotion_code: promotionCode ? String(promotionCode).toUpperCase() : null,
      discount_amount: Number(discountAmount),
      seat_total: Number(seatTotal),
      combo_total: Number(comboTotal),
      total_price: totalPrice,
      status: Booking.STATUS.PAID,
      paid_at: new Date(),
      created_by: createdBy,
    });
  }

  // Customer -> Booking -> Payment -> Earn Points. finalizeMomoOrder already only reaches this
  // point once per orderId (see the Invoice.findOne guard above), and earnPointsForBooking adds
  // its own unique-index backstop, so a duplicate payment callback never double-credits points.
  try {
    await loyaltyService.earnPointsForBooking({
      accountId: Number(accountId),
      bookingId: booking.id,
      amount: totalPrice,
      description: `Booking ${orderId}`,
    });
  } catch (err) {
    console.error(`Failed to award loyalty points for booking ${booking.id}:`, err);
  }

  const ticketCount = ticketIds.length;
  const basePerTicket = Math.floor(totalPrice / ticketCount);
  const remainder = totalPrice - basePerTicket * ticketCount;

  for (let index = 0; index < ticketIds.length; index += 1) {
    const isFirst = index === 0;
    const id = await nextId('invoice');
    await Invoice.create({
      id,
      booking_id: booking.id,
      ticket_id: Number(ticketIds[index]),
      account_id: Number(accountId),
      code: orderId,
      total_price: basePerTicket + (isFirst ? remainder : 0),
      combo_ids: comboIds.map(Number),
      voucher_code: isFirst && voucherCode ? String(voucherCode).toUpperCase() : null,
      promotion_code: isFirst && promotionCode ? String(promotionCode).toUpperCase() : null,
      discount_amount: isFirst ? Number(discountAmount) : 0,
      status: 1,
      created_by: createdBy,
      // Ticket 13: a Ticket only ever comes into existence here, once payment has cleared.
      qr_token: generateQrToken(),
      ticket_status: Invoice.TICKET_STATUS.ISSUED,
      issued_at: new Date(),
    });
    await Ticket.updateOne(
      { id: Number(ticketIds[index]) },
      { $set: { status: 0, held_by: null, held_until: null } },
    );
  }

  if (comboIds.length > 0) {
    try {
      await createLinkedComboOrder({
        bookingId: booking.id,
        branchId: booking.branch_id,
        accountId: Number(accountId),
        comboIds,
        createdBy,
        paymentMethod: comboPaymentMethod,
      });
    } catch (err) {
      // Never let the combo-fulfillment side effect block ticket/payment finalization —
      // the customer already paid and must get their tickets regardless.
      console.error(`Failed to create linked combo order for booking ${booking.id}:`, err);
    }
  }

  const account = await Account.findOne({ id: Number(accountId) });
  const firstTicket = await Ticket.findOne({ id: Number(ticketIds[0]) });
  if (account) {
    await sendInvoiceEmail(account.email, {
      seats: (await Ticket.find({ id: { $in: ticketIds.map(Number) } })).map((t) => t.seat_code),
      schedule_id: firstTicket ? firstTicket.schedule_id : null,
      price: totalPrice,
    });
  }

  if (firstTicket) {
    const schedule = await Schedule.findOne({ id: firstTicket.schedule_id });
    const room = schedule ? await Room.findOne({ id: schedule.room_id }) : null;
    const branch = room ? await Branch.findOne({ id: room.cinema_id }) : null;
    if (branch) {
      emitToOwner(branch.owner_id, 'booking:new', { branchId: branch.id, amount: totalPrice });
    }
  }

  return { alreadyProcessed: false, bookingId: booking.id };
}

async function findInvoicesByAccountId(accountId) {
  return Invoice.find({ account_id: accountId }).sort({ createdAt: -1 });
}

async function findTicketsByIds(ids) {
  return Ticket.find({ id: { $in: ids } });
}

async function findSchedulesByIds(ids) {
  return Schedule.find({ id: { $in: ids } });
}

async function findMoviesByIds(ids) {
  return Movie.find({ id: { $in: ids } });
}

async function findInvoiceById(id) {
  return Invoice.findOne({ id: Number(id) });
}

async function findTicketById(id) {
  return Ticket.findOne({ id: Number(id) });
}

async function findScheduleById(id) {
  return Schedule.findOne({ id: Number(id) });
}

async function updateTicketStatus(id, status) {
  return Ticket.updateOne({ id }, { $set: { status } });
}

async function findTicketsBySeatCodes(scheduleId, seatCodes) {
  return Ticket.find({ schedule_id: Number(scheduleId), seat_code: { $in: seatCodes } });
}

async function timeoutExpiredHolds(filter) {
  await Ticket.updateMany(
    { ...filter, status: Ticket.STATUS.HELD, held_until: { $lt: new Date() } },
    { $set: { status: Ticket.STATUS.TIMEOUT } },
  );
  return Ticket.updateMany(
    { ...filter, status: Ticket.STATUS.TIMEOUT },
    { $set: { status: Ticket.STATUS.AVAILABLE, held_by: null, held_until: null } },
  );
}

async function expireHeldTickets(scheduleId) {
  return timeoutExpiredHolds({ schedule_id: Number(scheduleId) });
}

async function expireAllHeldTickets() {
  return timeoutExpiredHolds({});
}

async function timeoutTicketsByIds(ticketIds) {
  await Ticket.updateMany(
    { id: { $in: ticketIds.map(Number) }, status: Ticket.STATUS.HELD },
    { $set: { status: Ticket.STATUS.TIMEOUT } },
  );
  return Ticket.updateMany(
    { id: { $in: ticketIds.map(Number) }, status: Ticket.STATUS.TIMEOUT },
    { $set: { status: Ticket.STATUS.AVAILABLE, held_by: null, held_until: null } },
  );
}

async function holdTickets({ scheduleId, seatCodes, accountId, until }) {
  await Ticket.updateMany(
    {
      schedule_id: Number(scheduleId),
      seat_code: { $in: seatCodes },
      $or: [{ status: Ticket.STATUS.AVAILABLE }, { status: Ticket.STATUS.HELD, held_by: accountId }],
    },
    { $set: { status: Ticket.STATUS.HELD, held_by: accountId, held_until: until } },
  );
  return findTicketsBySeatCodes(scheduleId, seatCodes);
}

async function releaseTickets({ scheduleId, seatCodes, accountId }) {
  await Ticket.updateMany(
    { schedule_id: Number(scheduleId), seat_code: { $in: seatCodes }, status: Ticket.STATUS.HELD, held_by: accountId },
    { $set: { status: Ticket.STATUS.AVAILABLE, held_by: null, held_until: null } },
  );
  return findTicketsBySeatCodes(scheduleId, seatCodes);
}

async function saveInvoice(invoice) {
  await invoice.save();
  return invoice;
}

// The three door/customer-facing Ticket transitions. Each keeps the legacy `status`/
// `checked_in` fields (still read by the existing invoice endpoints) in sync with the new
// `ticket_status` lifecycle instead of replacing them, so nothing else has to change.
async function cancelInvoiceRecord(invoice) {
  invoice.status = 0;
  invoice.ticket_status = Invoice.TICKET_STATUS.CANCELLED;
  await invoice.save();
  return invoice;
}

async function refundInvoiceRecord(invoice) {
  invoice.status = 2;
  invoice.ticket_status = Invoice.TICKET_STATUS.REFUNDED;
  await invoice.save();
  return invoice;
}

// Atomic conditional update: only succeeds while the invoice is still ISSUED, so two scanners
// racing to check in the same ticket can't both win — the loser's findOneAndUpdate matches
// nothing and gets back null. Never read-then-save here (Ticket 14 security requirement).
async function checkInInvoiceRecord({ id, accountId, branchId }) {
  return Invoice.findOneAndUpdate(
    { id: Number(id), ticket_status: Invoice.TICKET_STATUS.ISSUED },
    {
      $set: {
        checked_in: true,
        ticket_status: Invoice.TICKET_STATUS.USED,
        checked_in_at: new Date(),
        checked_in_by: accountId ?? null,
        checkin_branch_id: branchId ?? null,
      },
    },
    { new: true },
  );
}

async function findInvoiceByQrToken(token) {
  return Invoice.findOne({ qr_token: token });
}

// Joins Invoice (the issued Ticket) -> Ticket (the seat) -> Schedule -> Room -> Branch/Movie
// into the shape the customer- and door-facing ticket endpoints return.
async function buildTicketViews(invoices) {
  const ticketIds = [...new Set(invoices.map((inv) => inv.ticket_id))];
  const tickets = await Ticket.find({ id: { $in: ticketIds } });
  const ticketById = new Map(tickets.map((t) => [t.id, t]));

  const scheduleIds = [...new Set(tickets.map((t) => t.schedule_id))];
  const schedules = await Schedule.find({ id: { $in: scheduleIds } });
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  const roomIds = [...new Set(schedules.map((s) => s.room_id))];
  const rooms = await Room.find({ id: { $in: roomIds } });
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const branchIds = [...new Set(rooms.map((r) => r.cinema_id))];
  const branches = await Branch.find({ id: { $in: branchIds } });
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const movieIds = [...new Set(schedules.map((s) => s.movie_id))];
  const movies = await Movie.find({ id: { $in: movieIds } });
  const movieById = new Map(movies.map((m) => [m.id, m]));

  return invoices.map((inv) => {
    const ticket = ticketById.get(inv.ticket_id);
    const schedule = ticket ? scheduleById.get(ticket.schedule_id) : null;
    const room = schedule ? roomById.get(schedule.room_id) : null;
    const branch = room ? branchById.get(room.cinema_id) : null;
    const movie = schedule ? movieById.get(schedule.movie_id) : null;
    return {
      ticket_id: inv.id,
      booking_id: inv.booking_id,
      code: inv.code,
      showtime_id: ticket ? ticket.schedule_id : null,
      movie_id: schedule ? schedule.movie_id : null,
      branch_id: room ? room.cinema_id : null,
      room_id: schedule ? schedule.room_id : null,
      seat_id: ticket ? ticket.id : null,
      seat_code: ticket ? ticket.seat_code : null,
      seat_type: ticket ? ticket.seat_type : null,
      status: inv.ticket_status,
      checked_in: inv.checked_in,
      qr_token: inv.qr_token,
      issued_at: inv.issued_at,
      total_price: inv.total_price,
      movie: movie ? { id: movie.id, name: movie.name, avatar: movie.avatar } : null,
      schedule: schedule
        ? { id: schedule.id, movie_date: schedule.movie_date, time_begin: schedule.time_begin, time_end: schedule.time_end }
        : null,
      room: room ? { id: room.id, name: room.name, type: room.type } : null,
      branch: branch ? { id: branch.id, name: branch.name, address: branch.address, city: branch.city } : null,
    };
  });
}

// GET /api/my-tickets -> the caller's full ticket history (one row per seat), newest first.
async function findTicketViewsForAccount(accountId) {
  const invoices = await Invoice.find({ account_id: Number(accountId) }).sort({ createdAt: -1 });
  return buildTicketViews(invoices);
}

async function findTicketViewsForBooking(bookingId) {
  const invoices = await Invoice.find({ booking_id: Number(bookingId) }).sort({ id: 1 });
  return buildTicketViews(invoices);
}

async function findTicketViewById(id) {
  const invoice = await Invoice.findOne({ id: Number(id) });
  if (!invoice) return null;
  const [view] = await buildTicketViews([invoice]);
  return { view, invoice };
}

// Door check-in scans resolve their QR payload through here — never trusting anything the
// scanner itself claims about the ticket.
async function findTicketViewByQrToken(token) {
  const invoice = await findInvoiceByQrToken(token);
  if (!invoice) return null;
  const [view] = await buildTicketViews([invoice]);
  return { view, invoice };
}

// Flips ISSUED tickets whose showtime has clearly passed (start + the movie's runtime, plus
// a grace window) to EXPIRED. A ticket that was actually used/cancelled/refunded already left
// the ISSUED state via its own transition, so this only ever catches genuine no-shows.
const EXPIRY_GRACE_MINUTES = 30;
const DEFAULT_MOVIE_DURATION_MINUTES = 180;
const EARLY_CHECKIN_MINUTES = 60;

// Shared by expireIssuedTickets (auto-expiry sweep) and checkInInvoice/device check-in (door
// check-in) so they never disagree about when a ticket stops being checkinable. Door check-in
// opens `earlyCheckinMinutes` before the showtime and closes at the same cutoff the expiry
// sweep uses. `earlyCheckinMinutes` is Ticket 27's centralized CHECKIN_BEFORE_SHOWTIME setting —
// callers resolve it via systemConfig.service and pass it in; this stays a plain sync helper so
// the request-scoped callers can resolve a branch-specific override while the batch sweep below
// resolves one system-wide value per run instead of once per ticket. EARLY_CHECKIN_MINUTES is
// only the fallback for a caller that doesn't pass one (keeps this function's own unit tests
// working unchanged).
function getShowtimeCheckinWindow(schedule, movie, earlyCheckinMinutes = EARLY_CHECKIN_MINUTES) {
  const durationMinutes = movie?.duration || DEFAULT_MOVIE_DURATION_MINUTES;
  const showtimeStart = new Date(`${schedule.movie_date}T${schedule.time_begin}:00`).getTime();
  return {
    opensAt: showtimeStart - earlyCheckinMinutes * 60 * 1000,
    startsAt: showtimeStart,
    closesAt: showtimeStart + (durationMinutes + EXPIRY_GRACE_MINUTES) * 60 * 1000,
  };
}

async function expireIssuedTickets() {
  const issued = await Invoice.find({ ticket_status: Invoice.TICKET_STATUS.ISSUED });
  if (issued.length === 0) return 0;

  const ticketIds = [...new Set(issued.map((inv) => inv.ticket_id))];
  const tickets = await Ticket.find({ id: { $in: ticketIds } });
  const ticketById = new Map(tickets.map((t) => [t.id, t]));

  const scheduleIds = [...new Set(tickets.map((t) => t.schedule_id))];
  const schedules = await Schedule.find({ id: { $in: scheduleIds } });
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  const movieIds = [...new Set(schedules.map((s) => s.movie_id))];
  const movies = await Movie.find({ id: { $in: movieIds } });
  const movieById = new Map(movies.map((m) => [m.id, m]));

  const now = Date.now();
  const expiredIds = [];
  for (const inv of issued) {
    const ticket = ticketById.get(inv.ticket_id);
    const schedule = ticket ? scheduleById.get(ticket.schedule_id) : null;
    if (!schedule) continue;
    const movie = movieById.get(schedule.movie_id);
    const { closesAt } = getShowtimeCheckinWindow(schedule, movie);
    if (closesAt < now) expiredIds.push(inv.id);
  }
  if (expiredIds.length === 0) return 0;

  await Invoice.updateMany(
    { id: { $in: expiredIds } },
    { $set: { ticket_status: Invoice.TICKET_STATUS.EXPIRED } },
  );
  return expiredIds.length;
}

async function findAllInvoices({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Invoice.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Invoice.countDocuments(),
  ]);
  return { data, total };
}

async function findAccountsByIds(ids) {
  return Account.find({ id: { $in: ids } });
}

async function findInvoiceByCode(code) {
  return Invoice.findOne({ code: code.toUpperCase() });
}

async function findRoomById(id) {
  return Room.findOne({ id });
}

async function findCinemaById(id) {
  return Branch.findOne({ id });
}

async function findMovieById(id) {
  return Movie.findOne({ id });
}

// Walks Invoice -> Ticket -> Schedule -> Room -> Cinema to resolve the owning cinema,
// used to scope check-in/counter-sale access to the invoice's actual branch.
async function findCinemaIdByInvoiceId(id) {
  const invoice = await Invoice.findOne({ id: Number(id) });
  if (!invoice) return null;
  const ticket = await Ticket.findOne({ id: invoice.ticket_id });
  if (!ticket) return null;
  const schedule = await Schedule.findOne({ id: ticket.schedule_id });
  if (!schedule) return null;
  const room = await Room.findOne({ id: schedule.room_id });
  return room ? room.cinema_id : null;
}

async function findCinemaIdByTicketId(ticketId) {
  const ticket = await Ticket.findOne({ id: Number(ticketId) });
  if (!ticket) return null;
  const schedule = await Schedule.findOne({ id: ticket.schedule_id });
  if (!schedule) return null;
  const room = await Room.findOne({ id: schedule.room_id });
  return room ? room.cinema_id : null;
}

// Records a paid, immediate booking sold in person (cash/POS at the counter), reusing
// finalizeMomoOrder's invoice/ticket-writing logic with a synthetic, unique order code.
async function createCounterSale({
  ticketIds,
  comboIds,
  voucherCode,
  promotionCode,
  discountAmount,
  totalPrice,
  accountId,
  createdBy,
  seatTotal,
  comboTotal,
  branchId = null,
  idempotencyKey = null,
  shiftId = null,
}) {
  if (idempotencyKey) {
    const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) return { alreadyProcessed: true, bookingId: existing.booking_id };
  }

  const orderId = `CTR-${await nextId('counterOrder')}`;
  const result = await finalizeMomoOrder(
    orderId,
    { ticketIds, comboIds, voucherCode, promotionCode, discountAmount, totalPrice, accountId, createdBy, seatTotal, comboTotal },
    { comboPaymentMethod: 'CASH' },
  );

  if (!result.skipped && !result.alreadyProcessed) {
    await paymentRepository.createPayment({
      code: orderId,
      bookingId: result.bookingId,
      accountId,
      branchId,
      type: Payment.TYPE.COUNTER,
      method: Payment.METHOD.CASH,
      amount: totalPrice,
      status: Payment.STATUS.PAID,
      idempotencyKey,
      createdBy,
      shiftId,
    });
  }

  return result;
}

// Creates the PENDING Booking a MoMo redirect is issued against; finalizeMomoOrder flips
// it to PAID (or expireStalePendingBookings flips it to EXPIRED if payment never completes).
async function createPendingBooking({
  code,
  accountId,
  scheduleId,
  branchId,
  ticketIds,
  comboIds = [],
  voucherCode = null,
  promotionCode = null,
  discountAmount = 0,
  seatTotal = 0,
  comboTotal = 0,
  totalPrice,
  expiresAt,
}) {
  return Booking.create({
    id: await nextId('booking'),
    code,
    account_id: Number(accountId),
    schedule_id: Number(scheduleId),
    branch_id: Number(branchId),
    ticket_ids: ticketIds.map(Number),
    combo_ids: comboIds.map(Number),
    voucher_code: voucherCode ? String(voucherCode).toUpperCase() : null,
    promotion_code: promotionCode ? String(promotionCode).toUpperCase() : null,
    discount_amount: Number(discountAmount),
    seat_total: Number(seatTotal),
    combo_total: Number(comboTotal),
    total_price: totalPrice,
    status: Booking.STATUS.PENDING,
    expires_at: expiresAt,
  });
}

// Explicit payment failure (MoMo reported a non-zero resultCode) — a definite outcome,
// not a timeout, so it's cancelled rather than left for the expiry sweep.
async function cancelPendingBookingByCode(code) {
  return Booking.findOneAndUpdate(
    { code, status: Booking.STATUS.PENDING },
    { $set: { status: Booking.STATUS.CANCELLED, cancelled_at: new Date(), cancel_reason: 'Payment failed' } },
    { new: true },
  );
}

// Cancels a Booking and everything under it: releases its tickets back to AVAILABLE and
// cancels its sibling Invoice rows. Caller is responsible for authorization + cancellation
// window policy checks.
async function cancelBooking(booking, { reason = null } = {}) {
  await Ticket.updateMany(
    { id: { $in: booking.ticket_ids }, status: { $in: [Ticket.STATUS.BOOKED, Ticket.STATUS.HELD] } },
    { $set: { status: Ticket.STATUS.AVAILABLE, held_by: null, held_until: null } },
  );
  await Invoice.updateMany(
    { booking_id: booking.id },
    { $set: { status: 0, ticket_status: Invoice.TICKET_STATUS.CANCELLED } },
  );
  booking.status = Booking.STATUS.CANCELLED;
  booking.cancelled_at = new Date();
  if (reason) booking.cancel_reason = reason;
  await booking.save();
  return booking;
}

async function changeBookingShowtime(booking, { newScheduleId, newTicketIds }) {
  await Ticket.updateMany(
    { id: { $in: booking.ticket_ids }, status: { $in: [Ticket.STATUS.BOOKED, Ticket.STATUS.HELD] } },
    { $set: { status: Ticket.STATUS.AVAILABLE, held_by: null, held_until: null } },
  );
  await Ticket.updateMany(
    { id: { $in: newTicketIds } },
    { $set: { status: Ticket.STATUS.BOOKED, held_by: null, held_until: null } },
  );

  if (booking.status === Booking.STATUS.PAID) {
    const invoices = await Invoice.find({ booking_id: booking.id }).sort({ id: 1 });
    for (let i = 0; i < invoices.length && i < newTicketIds.length; i += 1) {
      invoices[i].ticket_id = Number(newTicketIds[i]);
      await invoices[i].save();
    }
  }

  booking.schedule_id = Number(newScheduleId);
  booking.ticket_ids = newTicketIds.map(Number);
  await booking.save();
  return booking;
}

// Ticket 15: bookings sitting on a Schedule that's being cancelled or rescheduled-away-from.
async function findBookingsBySchedule(scheduleId, statuses) {
  return Booking.find({ schedule_id: Number(scheduleId), status: { $in: statuses } });
}

// Cancels the booking (releases its tickets, cancels its invoices — same as cancelBooking) and,
// only if it had actually been paid, flips its Payment PAID -> REFUND_PENDING so the refund shows
// up as pending staff work. Never auto-completes the refund (that stays a manual confirmRefund
// call) — Ticket 15 explicitly forbids auto-refunding without an existing business policy for it.
async function cancelBookingAndRequestRefund(booking, reason) {
  await cancelBooking(booking, { reason });
  const payment = await paymentRepository.findByCode(booking.code);
  if (payment && payment.status === Payment.STATUS.PAID) {
    await paymentRepository.requestRefund(payment.id, reason);
  }
  return booking;
}

async function markNeedsRescheduleResponse(bookingId, value) {
  return Booking.updateOne({ id: Number(bookingId) }, { $set: { needs_reschedule_response: value } });
}

async function acceptReschedule(booking) {
  booking.needs_reschedule_response = false;
  await booking.save();
  return booking;
}

async function applyRefund(booking) {
  await Ticket.updateMany(
    { id: { $in: booking.ticket_ids }, status: { $in: [Ticket.STATUS.BOOKED, Ticket.STATUS.HELD] } },
    { $set: { status: Ticket.STATUS.AVAILABLE, held_by: null, held_until: null } },
  );
  await Invoice.updateMany(
    { booking_id: booking.id },
    { $set: { status: 2, ticket_status: Invoice.TICKET_STATUS.REFUNDED } },
  );
  booking.status = Booking.STATUS.CANCELLED;
  booking.cancelled_at = new Date();
  booking.cancel_reason = 'Refunded';
  await booking.save();

  // Business policy: a refunded booking's earned points are clawed back (see
  // loyaltyService.reversePointsForBooking for exactly how much and why). Never let this
  // failing block the refund itself — the customer's money/tickets already moved.
  try {
    await loyaltyService.reversePointsForBooking({ bookingId: booking.id, reason: `Booking ${booking.code} refunded` });
  } catch (err) {
    console.error(`Failed to reverse loyalty points for booking ${booking.id}:`, err);
  }

  return booking;
}

async function expireStalePendingBookings() {
  const stale = await Booking.find({ status: Booking.STATUS.PENDING, expires_at: { $lt: new Date() } });
  for (const booking of stale) {
    await timeoutTicketsByIds(booking.ticket_ids);
    booking.status = Booking.STATUS.EXPIRED;
    await booking.save();
  }
  return stale.length;
}

// Once every sibling Invoice under a Booking has been checked in, the booking itself is done.
async function maybeCompleteBooking(bookingId) {
  if (!bookingId) return null;
  const invoices = await Invoice.find({ booking_id: Number(bookingId) });
  if (invoices.length === 0 || !invoices.every((inv) => inv.checked_in && inv.status === 1)) return null;
  return Booking.findOneAndUpdate(
    { id: Number(bookingId), status: Booking.STATUS.PAID },
    { $set: { status: Booking.STATUS.COMPLETED } },
    { new: true },
  );
}

// Branch Admin: every branch they own. Employee: their single assigned branch. Used to scope
// BRANCH-permission-scope booking list/detail/cancel to the caller's own branch(es).
async function resolveAccessibleBranchIds(accountId) {
  const ownedBranches = await Branch.find({ owner_id: Number(accountId) }, { id: 1 });
  if (ownedBranches.length > 0) return ownedBranches.map((b) => b.id);
  const employee = await Employee.findOne({ user_id: Number(accountId), status: 1 });
  return employee ? [employee.branch_id] : [];
}

async function findBookings(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Booking.countDocuments(filter),
  ]);
  return { data, total };
}

async function findBookingById(id) {
  return Booking.findOne({ id: Number(id) });
}

async function buildPricingContext(schedule, accountId) {
  const room = await Room.findOne({ id: schedule.room_id });
  const categoryMappings = await MovieCategory.find({ movie_id: schedule.movie_id });
  const account = accountId ? await Account.findOne({ id: Number(accountId) }) : null;
  return {
    branchId: room ? room.cinema_id : (schedule.cinema_id ?? null),
    roomType: room ? room.type : null,
    categoryIds: categoryMappings.map((m) => m.cat_id),
    date: schedule.movie_date,
    timeBegin: schedule.time_begin,
    membershipLevel: account ? account.membership_level : 'NONE',
    basePrice: schedule.price,
  };
}

async function calculateTicketPrices(schedule, tickets, accountId) {
  const ctx = await buildPricingContext(schedule, accountId);
  const bySeatType = new Map();
  const results = new Map();
  for (const ticket of tickets) {
    if (!bySeatType.has(ticket.seat_type)) {
      bySeatType.set(ticket.seat_type, await pricingEngine.calculateSeatPrice({ ...ctx, seatType: ticket.seat_type }));
    }
    results.set(ticket.id, bySeatType.get(ticket.seat_type));
  }
  return results;
}

// A customer may apply a voucher OR a promotion to an order, never both — the controller
// rejects a request that sends both before this is ever called; if it somehow still receives
// both, voucherCode wins and promotionCode is ignored (defensive, not the primary guard).
async function computeOrderPricing({ ticketIds, comboIds = [], voucherCode, promotionCode, accountId }) {
  const tickets = await findTicketsByIds(ticketIds);
  if (tickets.length === 0) return null;

  const scheduleId = tickets[0].schedule_id;
  const schedule = await findScheduleById(scheduleId);
  if (!schedule) return null;

  const priceByTicketId = await calculateTicketPrices(schedule, tickets, accountId);
  const ticketPrices = tickets.map((t) => ({ ticketId: t.id, price: priceByTicketId.get(t.id)?.price ?? 0 }));
  const seatTotal = ticketPrices.reduce((sum, t) => sum + t.price, 0);

  const combos = comboIds.length > 0 ? await Combo.find({ id: { $in: comboIds.map(Number) } }) : [];
  const comboTotal = combos.reduce((sum, c) => sum + c.price, 0);
  const orderValue = seatTotal + comboTotal;

  let discountAmount = 0;
  let appliedVoucherCode = null;
  let appliedPromotionCode = null;
  if (voucherCode) {
    const voucher = await Voucher.findOne({ code: String(voucherCode).toUpperCase(), active: true });
    const eligibility = isVoucherEligible(voucher, { cinemaId: schedule.cinema_id, orderValue });
    if (eligibility.eligible) {
      discountAmount = computeVoucherDiscount(voucher, orderValue);
      appliedVoucherCode = voucher.code;
    }
  } else if (promotionCode) {
    const promotion = await Promotion.findOne({ code: String(promotionCode).toUpperCase() });
    const usage = promotion ? await promotionRepository.findUsage(promotion.id, accountId) : null;
    const eligibility = isPromotionEligible(promotion, {
      branchId: schedule.cinema_id,
      movieId: schedule.movie_id,
      showtimeId: schedule.id,
      comboIds,
      orderValue,
      customerUsedCount: usage ? usage.count : 0,
    });
    if (eligibility.eligible) {
      discountAmount = computePromotionDiscount(promotion, orderValue);
      appliedPromotionCode = promotion.code;
    }
  }

  const totalPrice = Math.max(orderValue - discountAmount, 0);
  return {
    scheduleId,
    seatTotal,
    comboTotal,
    discountAmount,
    totalPrice,
    voucherCode: appliedVoucherCode,
    promotionCode: appliedPromotionCode,
    ticketPrices,
  };
}

module.exports = {
  findScheduleByMovieDateTime,
  findTicketsByScheduleId,
  findUpcomingSchedulesForMovie,
  finalizeMomoOrder,
  findInvoicesByAccountId,
  findTicketsByIds,
  findSchedulesByIds,
  findMoviesByIds,
  findInvoiceById,
  findTicketById,
  findScheduleById,
  updateTicketStatus,
  findTicketsBySeatCodes,
  expireHeldTickets,
  expireAllHeldTickets,
  timeoutTicketsByIds,
  holdTickets,
  releaseTickets,
  saveInvoice,
  cancelInvoiceRecord,
  refundInvoiceRecord,
  checkInInvoiceRecord,
  getShowtimeCheckinWindow,
  findInvoiceByQrToken,
  findTicketViewsForAccount,
  findTicketViewsForBooking,
  findTicketViewById,
  findTicketViewByQrToken,
  expireIssuedTickets,
  findAllInvoices,
  findAccountsByIds,
  findInvoiceByCode,
  findRoomById,
  findCinemaById,
  findMovieById,
  findCinemaIdByInvoiceId,
  findCinemaIdByTicketId,
  createCounterSale,
  buildPricingContext,
  calculateTicketPrices,
  computeOrderPricing,
  createPendingBooking,
  cancelPendingBookingByCode,
  cancelBooking,
  changeBookingShowtime,
  applyRefund,
  findBookingsBySchedule,
  cancelBookingAndRequestRefund,
  markNeedsRescheduleResponse,
  acceptReschedule,
  expireStalePendingBookings,
  maybeCompleteBooking,
  resolveAccessibleBranchIds,
  findBookings,
  findBookingById,
};
