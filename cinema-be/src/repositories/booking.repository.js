const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const Account = require('../models/Account');
const Voucher = require('../models/Voucher');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Combo = require('../models/Combo');
const Payment = require('../models/Payment');
const paymentRepository = require('./payment.repository');
const nextId = require('../utils/nextId');
const { sendInvoiceEmail } = require('../utils/mailer');
const { emitToOwner } = require('../utils/socket');
const pricingEngine = require('../services/pricingEngine');
const { isVoucherEligible, computeVoucherDiscount } = require('../utils/voucherPricing');

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

// Creates the Invoice rows + marks tickets sold for a paid MoMo order. Idempotent on
// `orderId` (stored as Invoice.code) so a retried IPN call or a user landing on the
// redirect page twice never double-books.
async function finalizeMomoOrder(orderId, orderPayload) {
  const existing = await Invoice.findOne({ code: orderId });
  if (existing) return { alreadyProcessed: true };

  const {
    ticketIds = [],
    comboIds = [],
    voucherCode,
    discountAmount = 0,
    totalPrice = 0,
    accountId,
    createdBy = null,
    seatTotal = 0,
    comboTotal = 0,
  } = orderPayload;
  if (!accountId || ticketIds.length === 0) return { alreadyProcessed: false, skipped: true };

  if (voucherCode) {
    const voucher = await Voucher.findOne({ code: String(voucherCode).toUpperCase() });
    if (voucher) {
      await Voucher.updateOne({ id: voucher.id }, { $inc: { used_count: 1 } });
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
      discount_amount: Number(discountAmount),
      seat_total: Number(seatTotal),
      combo_total: Number(comboTotal),
      total_price: totalPrice,
      status: Booking.STATUS.PAID,
      paid_at: new Date(),
      created_by: createdBy,
    });
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
      discount_amount: isFirst ? Number(discountAmount) : 0,
      status: 1,
      created_by: createdBy,
    });
    await Ticket.updateOne(
      { id: Number(ticketIds[index]) },
      { $set: { status: 0, held_by: null, held_until: null } },
    );
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
  discountAmount,
  totalPrice,
  accountId,
  createdBy,
  seatTotal,
  comboTotal,
  branchId = null,
  idempotencyKey = null,
}) {
  if (idempotencyKey) {
    const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) return { alreadyProcessed: true, bookingId: existing.booking_id };
  }

  const orderId = `CTR-${await nextId('counterOrder')}`;
  const result = await finalizeMomoOrder(orderId, {
    ticketIds,
    comboIds,
    voucherCode,
    discountAmount,
    totalPrice,
    accountId,
    createdBy,
    seatTotal,
    comboTotal,
  });

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
  await Invoice.updateMany({ booking_id: booking.id }, { $set: { status: 0 } });
  booking.status = Booking.STATUS.CANCELLED;
  booking.cancelled_at = new Date();
  if (reason) booking.cancel_reason = reason;
  await booking.save();
  return booking;
}

async function applyRefund(booking) {
  await Ticket.updateMany(
    { id: { $in: booking.ticket_ids }, status: { $in: [Ticket.STATUS.BOOKED, Ticket.STATUS.HELD] } },
    { $set: { status: Ticket.STATUS.AVAILABLE, held_by: null, held_until: null } },
  );
  await Invoice.updateMany({ booking_id: booking.id }, { $set: { status: 2 } });
  booking.status = Booking.STATUS.CANCELLED;
  booking.cancelled_at = new Date();
  booking.cancel_reason = 'Refunded';
  await booking.save();
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

async function computeOrderPricing({ ticketIds, comboIds = [], voucherCode, accountId }) {
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

  let discountAmount = 0;
  let appliedVoucherCode = null;
  if (voucherCode) {
    const voucher = await Voucher.findOne({ code: String(voucherCode).toUpperCase(), active: true });
    const orderValue = seatTotal + comboTotal;
    const eligibility = isVoucherEligible(voucher, { cinemaId: schedule.cinema_id, orderValue });
    if (eligibility.eligible) {
      discountAmount = computeVoucherDiscount(voucher, orderValue);
      appliedVoucherCode = voucher.code;
    }
  }

  const totalPrice = Math.max(seatTotal + comboTotal - discountAmount, 0);
  return { scheduleId, seatTotal, comboTotal, discountAmount, totalPrice, voucherCode: appliedVoucherCode, ticketPrices };
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
  applyRefund,
  expireStalePendingBookings,
  maybeCompleteBooking,
  resolveAccessibleBranchIds,
  findBookings,
  findBookingById,
};
