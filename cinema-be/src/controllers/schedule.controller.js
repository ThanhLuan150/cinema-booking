const scheduleRepository = require('../repositories/schedule.repository');
const movieRepository = require('../repositories/movie.repository');
const roomRepository = require('../repositories/room.repository');
const seatRepository = require('../repositories/seat.repository');
const bookingRepository = require('../repositories/booking.repository');
const auditLogRepository = require('../repositories/auditLog.repository');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { sendShowtimeCancelledEmail, sendShowtimeRescheduledEmail } = require('../utils/mailer');
const { emitToAccount, emitToOwner, emitToAdmin } = require('../utils/socket');

// GET /api/schedule?branchId=&roomId=&movieId=&page=&limit= -> management list (schedule.read
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const accessibleCinemaIds =
    req.permissionScope === 'ALL' ? [] : await scheduleRepository.resolveAccessibleCinemaIds(req.account.accountId);

  const { data, total } = await scheduleRepository.findFiltered({
    scope: req.permissionScope,
    accessibleCinemaIds,
    cinemaId: req.query.branchId,
    roomId: req.query.roomId,
    movieId: req.query.movieId,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/schedule/:id
async function getById(req, res) {
  const schedule = await scheduleRepository.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  res.json(schedule);
}

// Shared movie/room/overlap validation for create and update. Returns { movie, room } on
// success, or writes an error response and returns null.
async function validateShowtime(req, res, { movie_id, room_id, movie_date, time_begin, time_end, excludeId }) {
  if (time_begin >= time_end) {
    res.status(400).json({ message: 'time_begin must be before time_end', code: 'INVALID_TIME_RANGE' });
    return null;
  }

  const movie = await movieRepository.findById(movie_id);
  if (!movie) {
    res.status(404).json({ message: 'Movie not found' });
    return null;
  }
  if (movie.status === 'INACTIVE') {
    res
      .status(400)
      .json({ message: 'Cannot schedule a showtime for an inactive movie', code: 'MOVIE_NOT_ACTIVE' });
    return null;
  }
  if (movie.premiere_date && movie_date < movie.premiere_date) {
    res
      .status(400)
      .json({ message: 'Showtime cannot be scheduled before the movie is released', code: 'BEFORE_PREMIERE' });
    return null;
  }

  const room = await roomRepository.findById(room_id);
  if (!room) {
    res.status(404).json({ message: 'Room not found' });
    return null;
  }
  if (room.status !== 'ACTIVE') {
    res
      .status(400)
      .json({ message: `Room is ${room.status.toLowerCase()} and cannot receive new showtimes`, code: 'ROOM_NOT_ACTIVE' });
    return null;
  }
  // Ticket generation (POST /api/ticket) is a separate call the client makes right after this
  // one, so a room with no seat map would leave a persisted showtime with no tickets behind —
  // a "ghost" showtime the booking page renders as an empty seat map. Fail here, before any write.
  if ((await seatRepository.countActiveByRoomId(room.id)) === 0) {
    res.status(400).json({
      message: 'This room has no seat map yet. Set up seats for this room first.',
      code: 'ROOM_HAS_NO_SEAT_MAP',
    });
    return null;
  }
  // BRANCH scope: the room must belong to the branch the requireCinemaOwnership middleware
  // already resolved for this caller (their own cinema, or the showtime's existing cinema).
  if (req.permissionScope !== 'ALL' && room.cinema_id !== req.branchId) {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }

  const overlap = await scheduleRepository.findOverlapping({ room_id, movie_date, time_begin, time_end, excludeId });
  if (overlap) {
    res
      .status(409)
      .json({ message: 'This room already has a showtime in the given time range', code: 'SCHEDULE_OVERLAP' });
    return null;
  }

  const bufferViolation = await scheduleRepository.findBufferViolation({
    room_id,
    movie_date,
    time_begin,
    time_end,
    excludeId,
  });
  if (bufferViolation) {
    res.status(409).json({
      message: `This room needs at least ${scheduleRepository.SHOWTIME_BUFFER_MINUTES} minutes between showtimes for cleaning/turnover`,
      code: 'SCHEDULE_BUFFER_TOO_SHORT',
    });
    return null;
  }

  return { movie, room };
}

// POST /api/schedule { movie_id, room_id, movie_date, time_begin, time_end, price }
// (schedule.create permission — super admin anywhere, branch admin within their own branch).
async function create(req, res) {
  const { movie_id, room_id, movie_date, time_begin, time_end, price } = req.body;
  if (!movie_id || !room_id || !movie_date || !time_begin || !time_end || price === undefined) {
    return res
      .status(400)
      .json({ message: 'movie_id, room_id, movie_date, time_begin, time_end and price are required' });
  }

  const validated = await validateShowtime(req, res, { movie_id, room_id, movie_date, time_begin, time_end });
  if (!validated) return;

  const id = await nextId('schedule');
  const schedule = await scheduleRepository.create({
    id,
    movie_id: Number(movie_id),
    room_id: Number(room_id),
    cinema_id: validated.room.cinema_id,
    movie_date,
    time_begin,
    time_end,
    price: Number(price),
    status: 'ACTIVE',
  });

  res.status(201).json(schedule);
}

// PUT /api/schedule/:id { movie_id, room_id, movie_date, time_begin, time_end, price }
// (schedule.update permission, branch-scoped)
async function update(req, res) {
  const existing = await scheduleRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Schedule not found' });
  if (existing.status === 'CANCELLED') {
    return res.status(400).json({ message: 'Cannot edit a cancelled showtime', code: 'SCHEDULE_CANCELLED' });
  }

  const movie_id = req.body.movie_id !== undefined ? req.body.movie_id : existing.movie_id;
  const room_id = req.body.room_id !== undefined ? req.body.room_id : existing.room_id;
  const movie_date = req.body.movie_date !== undefined ? req.body.movie_date : existing.movie_date;
  const time_begin = req.body.time_begin !== undefined ? req.body.time_begin : existing.time_begin;
  const time_end = req.body.time_end !== undefined ? req.body.time_end : existing.time_end;
  const price = req.body.price !== undefined ? Number(req.body.price) : existing.price;

  const validated = await validateShowtime(req, res, {
    movie_id,
    room_id,
    movie_date,
    time_begin,
    time_end,
    excludeId: existing.id,
  });
  if (!validated) return;

  const schedule = await scheduleRepository.updateFields(existing.id, {
    movie_id: Number(movie_id),
    room_id: Number(room_id),
    cinema_id: validated.room.cinema_id,
    movie_date,
    time_begin,
    time_end,
    price,
  });
  res.json(schedule);
}

// Ticket 15: cancels every still-active Booking on a showtime that's going away (either the whole
// Schedule was cancelled, or a Booking's own showtime moved and the customer chose to refund
// instead of accepting the new time). Releases seats/invoices via the existing cancelBooking path,
// auto-raises a refund request for anyone who'd actually paid (never auto-completes it — that's
// still a manual confirmRefund), writes an AuditLog row, and notifies the customer.
async function cancelAffectedBooking(booking, { reason, auditAction, performedBy, movie, schedule }) {
  const wasPaid = booking.status === Booking.STATUS.PAID;
  await bookingRepository.cancelBookingAndRequestRefund(booking, reason);
  await auditLogRepository.create({
    entityType: 'BOOKING',
    entityId: booking.id,
    action: auditAction,
    performedBy,
    reason,
    metadata: { scheduleId: schedule.id, wasPaid },
  });

  const account = await Account.findOne({ id: booking.account_id });
  if (account) {
    await sendShowtimeCancelledEmail(account.email, {
      movieName: movie ? movie.name : `Movie #${schedule.movie_id}`,
      movie_date: schedule.movie_date,
      time_begin: schedule.time_begin,
    });
  }
  emitToAccount(booking.account_id, 'showtime:cancelled', {
    bookingId: booking.id,
    scheduleId: schedule.id,
    refundRequested: wasPaid,
  });
}

// PATCH /api/schedule/:id/cancel (schedule.cancel permission, branch-scoped)
async function cancel(req, res) {
  const existing = await scheduleRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Schedule not found' });
  if (existing.status === 'CANCELLED') {
    return res.status(400).json({ message: 'This showtime has already been cancelled', code: 'ALREADY_CANCELLED' });
  }

  const schedule = await scheduleRepository.updateFields(existing.id, { status: 'CANCELLED' });
  const performedBy = req.account ? req.account.accountId : null;
  const reason = req.body?.reason || 'Showtime cancelled by cinema';

  const affectedBookings = await bookingRepository.findBookingsBySchedule(schedule.id, ['PENDING', 'PAID']);
  const movie = await movieRepository.findById(schedule.movie_id);
  for (const booking of affectedBookings) {
    await cancelAffectedBooking(booking, {
      reason,
      auditAction:
        booking.status === Booking.STATUS.PAID
          ? AuditLog.ACTION.BOOKING_REFUND_REQUESTED
          : AuditLog.ACTION.BOOKING_CANCELLED_SHOWTIME_CANCELLED,
      performedBy,
      movie,
      schedule,
    });
  }

  await auditLogRepository.create({
    entityType: 'SCHEDULE',
    entityId: schedule.id,
    action: AuditLog.ACTION.SCHEDULE_CANCELLED,
    performedBy,
    reason,
    metadata: { affectedBookings: affectedBookings.length },
  });

  const room = await roomRepository.findById(schedule.room_id);
  if (room) {
    const branch = await Branch.findOne({ id: room.cinema_id });
    if (branch) emitToOwner(branch.owner_id, 'showtime:cancelled', { scheduleId: schedule.id, branchId: branch.id });
  }
  emitToAdmin('showtime:cancelled', { scheduleId: schedule.id });

  res.json({ ...schedule.toJSON(), affectedBookings: affectedBookings.length });
}

// PATCH /api/schedule/:id/reschedule { movie_date, time_begin, time_end }
// (schedule.reschedule permission, branch-scoped). Deliberately narrower than update() — only
// the showtime itself moves; movie/room/price edits that don't affect a paying customer still go
// through update(). Every PAID booking on the old time is flagged for a customer decision
// (accept the new time, or refund) via POST /bookings/:id/reschedule-response; PENDING holds are
// left alone since their schedule_id/seats don't change.
async function reschedule(req, res) {
  const existing = await scheduleRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Schedule not found' });
  if (existing.status === 'CANCELLED') {
    return res.status(400).json({ message: 'Cannot reschedule a cancelled showtime', code: 'SCHEDULE_CANCELLED' });
  }

  const { movie_date, time_begin, time_end } = req.body;
  if (!movie_date || !time_begin || !time_end) {
    return res.status(400).json({ message: 'movie_date, time_begin and time_end are required' });
  }
  if (movie_date === existing.movie_date && time_begin === existing.time_begin && time_end === existing.time_end) {
    return res.status(400).json({ message: 'The new showtime is identical to the current one', code: 'NO_CHANGE' });
  }

  const validated = await validateShowtime(req, res, {
    movie_id: existing.movie_id,
    room_id: existing.room_id,
    movie_date,
    time_begin,
    time_end,
    excludeId: existing.id,
  });
  if (!validated) return;

  const oldSnapshot = { movie_date: existing.movie_date, time_begin: existing.time_begin, time_end: existing.time_end };
  const schedule = await scheduleRepository.updateFields(existing.id, { movie_date, time_begin, time_end });
  const performedBy = req.account ? req.account.accountId : null;

  const affectedBookings = await bookingRepository.findBookingsBySchedule(schedule.id, [Booking.STATUS.PAID]);
  for (const booking of affectedBookings) {
    await bookingRepository.markNeedsRescheduleResponse(booking.id, true);
    await auditLogRepository.create({
      entityType: 'BOOKING',
      entityId: booking.id,
      action: AuditLog.ACTION.BOOKING_RESCHEDULE_NOTIFIED,
      performedBy,
      metadata: { scheduleId: schedule.id, from: oldSnapshot, to: { movie_date, time_begin, time_end } },
    });

    const account = await Account.findOne({ id: booking.account_id });
    if (account) {
      await sendShowtimeRescheduledEmail(account.email, {
        movieName: validated.movie.name,
        oldDate: oldSnapshot.movie_date,
        oldTime: oldSnapshot.time_begin,
        newDate: movie_date,
        newTime: time_begin,
      });
    }
    emitToAccount(booking.account_id, 'showtime:rescheduled', {
      bookingId: booking.id,
      scheduleId: schedule.id,
      from: oldSnapshot,
      to: { movie_date, time_begin, time_end },
    });
  }

  await auditLogRepository.create({
    entityType: 'SCHEDULE',
    entityId: schedule.id,
    action: AuditLog.ACTION.SCHEDULE_RESCHEDULED,
    performedBy,
    metadata: { from: oldSnapshot, to: { movie_date, time_begin, time_end }, affectedBookings: affectedBookings.length },
  });

  if (validated.room) {
    const branch = await Branch.findOne({ id: validated.room.cinema_id });
    if (branch) emitToOwner(branch.owner_id, 'showtime:rescheduled', { scheduleId: schedule.id, branchId: branch.id });
  }
  emitToAdmin('showtime:rescheduled', { scheduleId: schedule.id });

  res.json({ ...schedule.toJSON(), affectedBookings: affectedBookings.length });
}

// DELETE /api/schedule/:id (schedule.delete permission, branch-scoped)
async function remove(req, res) {
  const existing = await scheduleRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Schedule not found' });

  await scheduleRepository.remove(existing.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, cancel, reschedule, remove };
