const bookingRepository = require('../repositories/booking.repository');
const employeeRepository = require('../repositories/employee.repository');
const { withCategories } = require('../utils/withCategories');
const { createMomoPaymentUrl, verifyMomoSignature, decodeExtraData } = require('../utils/momo');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// True if the caller is allowed to act on bookings belonging to `cinema`: super admin,
// the branch admin who owns it, or an active employee staffed there.
async function canAccessCinema(account, cinema) {
  if (account.role === 0) return true;
  if (!cinema) return false;
  if (account.role === 2) return cinema.owner_id === account.accountId;
  if (account.role === 3) {
    const employee = await employeeRepository.findActiveByAccountAndCinema(account.accountId, cinema.id);
    return Boolean(employee);
  }
  return false;
}

// POST /api/scheduleId { movie_id, movie_date, time_begin } -> { id } (auth required)
async function resolveScheduleId(req, res) {
  const { movie_id, movie_date, time_begin } = req.body;
  const schedule = await bookingRepository.findScheduleByMovieDateTime({ movie_id, movie_date, time_begin });
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  res.json({ id: schedule.id });
}

// GET /api/bookseat/:scheduleId -> seat grid for that schedule (auth required)
async function bookseat(req, res) {
  const tickets = await bookingRepository.findTicketsByScheduleId(req.params.scheduleId);
  res.json(tickets);
}

// GET /api/bookticket/:movieId -> schedules for a movie, grouped by date (auth required)
async function bookticket(req, res) {
  const today = new Date().toISOString().split('T')[0];
  const schedules = await bookingRepository.findUpcomingSchedulesForMovie(req.params.movieId, today);

  const byDate = new Map();
  for (const schedule of schedules) {
    if (!byDate.has(schedule.movie_date)) byDate.set(schedule.movie_date, []);
    byDate.get(schedule.movie_date).push(schedule.time_begin);
  }

  const grouped = Array.from(byDate.entries()).map(([movie_date, times]) => ({ movie_date, times }));
  res.json(grouped);
}

// POST /api/MomoPayment { ticketIds, comboIds, voucherCode, discountAmount, totalPrice }
// -> returns the MoMo payment redirect URL as a raw string (auth required). The booking
// details ride along in MoMo's extraData so the callback can finalize the exact order.
async function createMomoPayment(req, res) {
  const { ticketIds, comboIds, voucherCode, discountAmount, totalPrice } = req.body;
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'ticketIds is required' });
  }

  const payUrl = await createMomoPaymentUrl(totalPrice, {
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: voucherCode || null,
    discountAmount: discountAmount || 0,
    totalPrice: Number(totalPrice) || 0,
    accountId: req.account.accountId,
  });
  res.type('text/plain').send(payUrl);
}

// POST /api/MomoPayment/ipn -> MoMo's server-to-server payment confirmation (public;
// authenticated via MoMo's HMAC signature instead of our own JWT since MoMo can't hold one).
async function momoIpn(req, res) {
  if (!verifyMomoSignature(req.body)) {
    return res.status(400).json({ resultCode: 1, message: 'Invalid signature' });
  }
  if (String(req.body.resultCode) !== '0') {
    return res.json({ resultCode: 0, message: 'Acknowledged (payment not successful)' });
  }

  const orderPayload = decodeExtraData(req.body.extraData);
  await bookingRepository.finalizeMomoOrder(req.body.orderId, orderPayload);
  res.json({ resultCode: 0, message: 'Confirm Success' });
}

// POST /api/MomoPayment/confirm -> browser-redirect fallback for local dev, where MoMo's
// IPN can't reach localhost. Same verification + finalize logic as the IPN handler, just
// triggered by the user's own browser landing on the redirect page instead of MoMo's servers.
async function momoConfirm(req, res) {
  if (!verifyMomoSignature(req.body)) {
    return res.status(400).json({ message: 'Invalid signature' });
  }
  if (String(req.body.resultCode) !== '0') {
    return res.status(400).json({ message: req.body.message || 'Payment failed', code: 'PAYMENT_FAILED' });
  }

  const orderPayload = decodeExtraData(req.body.extraData);
  if (orderPayload.accountId && Number(orderPayload.accountId) !== req.account.accountId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const result = await bookingRepository.finalizeMomoOrder(req.body.orderId, orderPayload);
  res.json({ message: 'success', ...result });
}

// GET /api/my-invoices -> booking history for the caller, joined with ticket/schedule/movie details
async function myInvoices(req, res) {
  const invoices = await bookingRepository.findInvoicesByAccountId(req.account.accountId);
  const ticketIds = invoices.map((inv) => inv.ticket_id);
  const tickets = await bookingRepository.findTicketsByIds(ticketIds);
  const ticketById = new Map(tickets.map((t) => [t.id, t]));

  const scheduleIds = [...new Set(tickets.map((t) => t.schedule_id))];
  const schedules = await bookingRepository.findSchedulesByIds(scheduleIds);
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  const movieIds = [...new Set(schedules.map((s) => s.movie_id))];
  const movies = await bookingRepository.findMoviesByIds(movieIds);
  const moviesWithCategories = await withCategories(movies);
  const movieById = new Map(moviesWithCategories.map((m) => [m.id, m]));

  const result = invoices.map((inv) => {
    const ticket = ticketById.get(inv.ticket_id);
    const schedule = ticket ? scheduleById.get(ticket.schedule_id) : null;
    const movie = schedule ? movieById.get(schedule.movie_id) : null;
    return {
      ...inv.toJSON(),
      ticket: ticket ? { seat_code: ticket.seat_code, seat_type: ticket.seat_type, status: ticket.status } : null,
      schedule: schedule
        ? { id: schedule.id, movie_date: schedule.movie_date, time_begin: schedule.time_begin }
        : null,
      movie: movie ? { id: movie.id, name: movie.name, avatar: movie.avatar, categories: movie.categories } : null,
    };
  });

  res.json(result);
}

// POST /api/invoice/:id/cancel -> cancels a booking if the showtime is more than 2h away (auth required)
async function cancelInvoice(req, res) {
  const invoice = await bookingRepository.findInvoiceById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  if (invoice.account_id !== req.account.accountId && req.account.role !== 0) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (invoice.status === 0) {
    return res
      .status(400)
      .json({ message: 'This ticket has already been cancelled', code: 'TICKET_ALREADY_CANCELLED' });
  }

  const ticket = await bookingRepository.findTicketById(invoice.ticket_id);
  if (ticket) {
    const schedule = await bookingRepository.findScheduleById(ticket.schedule_id);
    if (schedule) {
      const showtime = new Date(`${schedule.movie_date}T${schedule.time_begin}:00`);
      const hoursUntilShowtime = (showtime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilShowtime < 2) {
        return res.status(400).json({
          message: 'Tickets can only be cancelled at least 2 hours before showtime',
          code: 'CANCEL_WINDOW_EXPIRED',
        });
      }
    }
    await bookingRepository.updateTicketStatus(ticket.id, 1);
  }

  invoice.status = 0;
  await bookingRepository.saveInvoice(invoice);

  res.json(invoice);
}

// GET /api/admin/invoices?page=&limit= -> transactions, newest first (admin only)
async function adminInvoices(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data: invoices, total } = await bookingRepository.findAllInvoices({ skip, limit });
  const ticketIds = invoices.map((inv) => inv.ticket_id);
  const tickets = await bookingRepository.findTicketsByIds(ticketIds);
  const ticketById = new Map(tickets.map((t) => [t.id, t]));

  const scheduleIds = [...new Set(tickets.map((t) => t.schedule_id))];
  const schedules = await bookingRepository.findSchedulesByIds(scheduleIds);
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  const movieIds = [...new Set(schedules.map((s) => s.movie_id))];
  const movies = await bookingRepository.findMoviesByIds(movieIds);
  const movieById = new Map(movies.map((m) => [m.id, m]));

  const accountIds = [...new Set(invoices.map((inv) => inv.account_id))];
  const accounts = await bookingRepository.findAccountsByIds(accountIds);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const result = invoices.map((inv) => {
    const ticket = ticketById.get(inv.ticket_id);
    const schedule = ticket ? scheduleById.get(ticket.schedule_id) : null;
    const movie = schedule ? movieById.get(schedule.movie_id) : null;
    const account = accountById.get(inv.account_id);
    return {
      ...inv.toJSON(),
      ticket: ticket ? { seat_code: ticket.seat_code } : null,
      movie: movie ? { name: movie.name } : null,
      account: account ? { email: account.email, name: account.name } : null,
    };
  });

  res.json(buildPaginatedResult({ data: result, total, page, limit }));
}

// POST /api/invoice/:id/refund -> admin marks a transaction refunded and reopens the seat
async function refundInvoice(req, res) {
  const invoice = await bookingRepository.findInvoiceById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  if (invoice.status === 2) {
    return res
      .status(400)
      .json({ message: 'This transaction has already been refunded', code: 'ALREADY_REFUNDED' });
  }

  await bookingRepository.updateTicketStatus(invoice.ticket_id, 1);
  invoice.status = 2;
  await bookingRepository.saveInvoice(invoice);

  res.json(invoice);
}

// GET /api/invoice/lookup/:code -> booking detail for check-in (admin or theater staff, owner-scoped)
async function lookupInvoice(req, res) {
  const invoice = await bookingRepository.findInvoiceByCode(req.params.code);
  if (!invoice)
    return res.status(404).json({ message: 'No ticket found with this code', code: 'INVOICE_NOT_FOUND_BY_CODE' });

  const ticket = await bookingRepository.findTicketById(invoice.ticket_id);
  const schedule = ticket ? await bookingRepository.findScheduleById(ticket.schedule_id) : null;
  const room = schedule ? await bookingRepository.findRoomById(schedule.room_id) : null;
  const cinema = room ? await bookingRepository.findCinemaById(room.cinema_id) : null;
  const movie = schedule ? await bookingRepository.findMovieById(schedule.movie_id) : null;

  if (!(await canAccessCinema(req.account, cinema))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  res.json({
    ...invoice.toJSON(),
    ticket: ticket ? { seat_code: ticket.seat_code, seat_type: ticket.seat_type, status: ticket.status } : null,
    schedule: schedule ? { movie_date: schedule.movie_date, time_begin: schedule.time_begin } : null,
    movie: movie ? { name: movie.name } : null,
    cinema: cinema ? { name: cinema.name } : null,
  });
}

// POST /api/invoice/:id/checkin -> door check-in, marks the booking as admitted
// (super admin, or branch admin/employee scoped to the invoice's own cinema).
async function checkInInvoice(req, res) {
  const invoice = await bookingRepository.findInvoiceById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  if (invoice.status !== 1) {
    return res.status(400).json({ message: 'Only paid bookings can be checked in', code: 'INVOICE_NOT_PAID' });
  }
  if (invoice.checked_in) {
    return res.status(400).json({ message: 'This ticket has already been checked in', code: 'ALREADY_CHECKED_IN' });
  }

  invoice.checked_in = true;
  await bookingRepository.saveInvoice(invoice);

  res.json(invoice);
}

// POST /api/invoice/counter-sale { ticketIds, comboIds, voucherCode, discountAmount, totalPrice, accountId, cinema_id }
// -> immediate, paid booking sold in person (cash/POS); requireCinemaAccess already
// confirmed the caller may act for cinema_id — this cross-checks the tickets actually
// belong to that cinema before writing anything.
async function createCounterSale(req, res) {
  const { ticketIds, comboIds, voucherCode, discountAmount, totalPrice, accountId } = req.body;
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'ticketIds is required' });
  }
  if (!accountId) {
    return res.status(400).json({ message: 'accountId is required' });
  }

  for (const ticketId of ticketIds) {
    const cinemaId = await bookingRepository.findCinemaIdByTicketId(ticketId);
    if (cinemaId !== req.cinemaId) {
      return res.status(400).json({ message: 'All tickets must belong to the target cinema', code: 'TICKET_CINEMA_MISMATCH' });
    }
  }

  const result = await bookingRepository.createCounterSale({
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: voucherCode || null,
    discountAmount: discountAmount || 0,
    totalPrice: Number(totalPrice) || 0,
    accountId: Number(accountId),
    createdBy: req.account.accountId,
  });

  if (result.skipped) return res.status(400).json({ message: 'Invalid counter sale payload' });
  res.status(201).json(result);
}

module.exports = {
  resolveScheduleId,
  bookseat,
  bookticket,
  createMomoPayment,
  momoIpn,
  momoConfirm,
  myInvoices,
  cancelInvoice,
  adminInvoices,
  refundInvoice,
  lookupInvoice,
  checkInInvoice,
  createCounterSale,
};
