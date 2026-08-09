const scheduleRepository = require('../repositories/schedule.repository');
const movieRepository = require('../repositories/movie.repository');
const roomRepository = require('../repositories/room.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// GET /api/schedule?branchId=&roomId=&page=&limit= -> management list (schedule.read
// permission). ALL scope (super admin) sees every showtime; BRANCH scope (branch admin,
// employee) is restricted to the caller's own branch(es).
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const accessibleCinemaIds =
    req.permissionScope === 'ALL' ? [] : await scheduleRepository.resolveAccessibleCinemaIds(req.account.accountId);

  const { data, total } = await scheduleRepository.findFiltered({
    scope: req.permissionScope,
    accessibleCinemaIds,
    branchId: req.query.branchId,
    roomId: req.query.roomId,
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
  if (room.status === 'INACTIVE') {
    res.status(400).json({ message: 'Room is not active', code: 'ROOM_NOT_ACTIVE' });
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

// PATCH /api/schedule/:id/cancel (schedule.cancel permission, branch-scoped)
async function cancel(req, res) {
  const existing = await scheduleRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Schedule not found' });
  if (existing.status === 'CANCELLED') {
    return res.status(400).json({ message: 'This showtime has already been cancelled', code: 'ALREADY_CANCELLED' });
  }

  const schedule = await scheduleRepository.updateFields(existing.id, { status: 'CANCELLED' });
  res.json(schedule);
}

// DELETE /api/schedule/:id (schedule.delete permission, branch-scoped)
async function remove(req, res) {
  const existing = await scheduleRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Schedule not found' });

  await scheduleRepository.remove(existing.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, cancel, remove };
