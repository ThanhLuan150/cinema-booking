const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Account = require('../models/Account');
const Voucher = require('../models/Voucher');
const Room = require('../models/Room');
const Cinema = require('../models/Cinema');
const Movie = require('../models/Movie');
const nextId = require('../utils/nextId');
const { sendInvoiceEmail } = require('../utils/mailer');
const { emitToOwner } = require('../utils/socket');

async function findScheduleByMovieDateTime({ movie_id, movie_date, time_begin }) {
  return Schedule.findOne({ movie_id: Number(movie_id), movie_date, time_begin });
}

async function findTicketsByScheduleId(scheduleId) {
  return Ticket.find({ schedule_id: Number(scheduleId) }).sort({ seat_index: 1 });
}

async function findUpcomingSchedulesForMovie(movieId, fromDate) {
  return Schedule.find({ movie_id: Number(movieId), movie_date: { $gte: fromDate } }).sort({
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

  const { ticketIds = [], comboIds = [], voucherCode, discountAmount = 0, totalPrice = 0, accountId } = orderPayload;
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
    });
    await Ticket.updateOne({ id: Number(ticketIds[index]) }, { $set: { status: 0 } });
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
    const cinema = room ? await Cinema.findOne({ id: room.cinema_id }) : null;
    if (cinema) {
      emitToOwner(cinema.owner_id, 'booking:new', { cinemaId: cinema.id, amount: totalPrice });
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
  return Cinema.findOne({ id });
}

async function findMovieById(id) {
  return Movie.findOne({ id });
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
  saveInvoice,
  findAllInvoices,
  findAccountsByIds,
  findInvoiceByCode,
  findRoomById,
  findCinemaById,
  findMovieById,
};
