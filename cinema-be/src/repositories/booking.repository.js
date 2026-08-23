const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Account = require('../models/Account');
const Voucher = require('../models/Voucher');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Combo = require('../models/Combo');
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
  } = orderPayload;
  if (!accountId || ticketIds.length === 0) return { alreadyProcessed: false, skipped: true };

  if (voucherCode) {
    const voucher = await Voucher.findOne({ code: String(voucherCode).toUpperCase() });
    if (voucher) {
      await Voucher.updateOne({ id: voucher.id }, { $inc: { used_count: 1 } });
    }
  }

  const ticketCount = ticketIds.length;
  const basePerTicket = Math.floor(totalPrice / ticketCount);
  const remainder = totalPrice - basePerTicket * ticketCount;

  for (let index = 0; index < ticketIds.length; index += 1) {
    const isFirst = index === 0;
    const id = await nextId('invoice');
    await Invoice.create({
      id,
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

  return { alreadyProcessed: false };
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
async function createCounterSale({ ticketIds, comboIds, voucherCode, discountAmount, totalPrice, accountId, createdBy }) {
  const orderId = `CTR-${await nextId('counterOrder')}`;
  return finalizeMomoOrder(orderId, { ticketIds, comboIds, voucherCode, discountAmount, totalPrice, accountId, createdBy });
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
};
