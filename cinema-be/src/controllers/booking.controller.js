const bookingRepository = require('../repositories/booking.repository');
const employeeRepository = require('../repositories/employee.repository');
const { withCategories } = require('../utils/withCategories');
const { createMomoPaymentUrl, verifyMomoSignature, decodeExtraData } = require('../utils/momo');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// How long a seat selection is reserved for a customer before it's released back to AVAILABLE.
const HOLD_TTL_MS = 5 * 60 * 1000;

async function canAccessCinema(req, branch) {
  if (req.permissionScope === 'ALL') return true;
  if (!branch) return false;
  if (branch.owner_id === req.account.accountId) return true;
  const employee = await employeeRepository.findActiveByAccountAndBranch(req.account.accountId, branch.id);
  return Boolean(employee);
}

// POST /api/scheduleId { movie_id, movie_date, time_begin } -> { id } (auth required)
async function resolveScheduleId(req, res) {
  const { movie_id, movie_date, time_begin } = req.body;
  const schedule = await bookingRepository.findScheduleByMovieDateTime({ movie_id, movie_date, time_begin });
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  res.json({ id: schedule.id });
}

// GET /api/bookseat/:scheduleId -> seat grid for that schedule (auth required). Status is always
async function bookseat(req, res) {
  await bookingRepository.expireHeldTickets(req.params.scheduleId);
  const tickets = await bookingRepository.findTicketsByScheduleId(req.params.scheduleId);
  const accountId = req.account ? req.account.accountId : null;

  const schedule = tickets.length > 0 ? await bookingRepository.findScheduleById(req.params.scheduleId) : null;
  const priceByTicketId = schedule
    ? await bookingRepository.calculateTicketPrices(schedule, tickets, accountId)
    : new Map();

  res.json(
    tickets.map((t) => ({
      id: t.id,
      seat_code: t.seat_code,
      seat_type: t.seat_type,
      status: t.status,
      held_by_me: t.status === 2 && t.held_by === accountId,
      price: priceByTicketId.get(t.id)?.price ?? null,
    })),
  );
}

// POST /api/bookseat/:scheduleId/hold { seatCodes } -> reserves seats for the caller for
async function holdSeats(req, res) {
  const { seatCodes } = req.body;
  if (!Array.isArray(seatCodes) || seatCodes.length === 0) {
    return res.status(400).json({ message: 'seatCodes is required' });
  }

  await bookingRepository.expireHeldTickets(req.params.scheduleId);
  const heldUntil = new Date(Date.now() + HOLD_TTL_MS);
  const accountId = req.account.accountId;
  const tickets = await bookingRepository.holdTickets({
    scheduleId: req.params.scheduleId,
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
    return res.status(409).json({ message: 'One or more seats are no longer available', code: 'SEAT_UNAVAILABLE', seatCodes: conflicts });
  }
  res.json({ held, held_until: heldUntil });
}

// POST /api/bookseat/:scheduleId/release { seatCodes } -> releases the caller's own held seats
async function releaseSeats(req, res) {
  const { seatCodes } = req.body;
  if (!Array.isArray(seatCodes) || seatCodes.length === 0) {
    return res.status(400).json({ message: 'seatCodes is required' });
  }

  const accountId = req.account.accountId;
  const existing = await bookingRepository.findTicketsBySeatCodes(req.params.scheduleId, seatCodes);
  const heldByOthers = existing.filter((t) => t.status === 2 && t.held_by !== accountId);
  if (heldByOthers.length > 0) {
    return res.status(403).json({
      message: 'Cannot release seats held by another customer',
      code: 'NOT_YOUR_HOLD',
      seatCodes: heldByOthers.map((t) => t.seat_code),
    });
  }

  await bookingRepository.releaseTickets({ scheduleId: req.params.scheduleId, seatCodes, accountId });
  res.json({ released: seatCodes });
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
async function createMomoPayment(req, res) {
  const { ticketIds, comboIds, voucherCode } = req.body;
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'ticketIds is required' });
  }

  const accountId = req.account.accountId;
  const tickets = await bookingRepository.findTicketsByIds(ticketIds);
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const unavailable = ticketIds.filter((id) => {
    const ticket = ticketById.get(Number(id));
    if (!ticket) return true;
    return !(ticket.status === 1 || (ticket.status === 2 && ticket.held_by === accountId));
  });
  if (unavailable.length > 0) {
    return res.status(409).json({
      message: 'One or more selected seats are no longer available',
      code: 'SEAT_UNAVAILABLE',
      ticketIds: unavailable,
    });
  }

  // Backend computes the authoritative order total here — any totalPrice/discountAmount the
  const pricing = await bookingRepository.computeOrderPricing({
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: voucherCode || null,
    accountId,
  });
  if (!pricing) {
    return res.status(400).json({ message: 'Unable to price this order', code: 'PRICING_FAILED' });
  }

  // Re-hold (or extend the hold on) these seats for the duration of the MoMo redirect so they
  await bookingRepository.holdTickets({
    scheduleId: tickets[0].schedule_id,
    seatCodes: tickets.map((t) => t.seat_code),
    accountId,
    until: new Date(Date.now() + HOLD_TTL_MS),
  });

  const payUrl = await createMomoPaymentUrl(pricing.totalPrice, {
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: pricing.voucherCode,
    discountAmount: pricing.discountAmount,
    totalPrice: pricing.totalPrice,
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
  if (invoice.account_id !== req.account.accountId && req.permissionScope !== 'ALL') {
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

  if (!(await canAccessCinema(req, cinema))) {
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

// POST /api/invoice/counter-sale { ticketIds, comboIds, voucherCode, accountId, cinema_id }
async function createCounterSale(req, res) {
  const { ticketIds, comboIds, voucherCode, accountId } = req.body;
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'ticketIds is required' });
  }
  if (!accountId) {
    return res.status(400).json({ message: 'accountId is required' });
  }

  for (const ticketId of ticketIds) {
    const branchId = await bookingRepository.findCinemaIdByTicketId(ticketId);
    if (branchId !== req.branchId) {
      return res.status(400).json({ message: 'All tickets must belong to the target cinema', code: 'TICKET_CINEMA_MISMATCH' });
    }
  }

  const pricing = await bookingRepository.computeOrderPricing({
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: voucherCode || null,
    accountId: Number(accountId),
  });
  if (!pricing) {
    return res.status(400).json({ message: 'Invalid counter sale payload' });
  }

  const result = await bookingRepository.createCounterSale({
    ticketIds,
    comboIds: comboIds || [],
    voucherCode: pricing.voucherCode,
    discountAmount: pricing.discountAmount,
    totalPrice: pricing.totalPrice,
    accountId: Number(accountId),
    createdBy: req.account.accountId,
  });

  if (result.skipped) return res.status(400).json({ message: 'Invalid counter sale payload' });
  res.status(201).json(result);
}

module.exports = {
  resolveScheduleId,
  bookseat,
  holdSeats,
  releaseSeats,
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
