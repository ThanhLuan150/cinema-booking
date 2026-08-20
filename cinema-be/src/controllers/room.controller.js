const roomRepository = require('../repositories/room.repository');
const seatRepository = require('../repositories/seat.repository');
const scheduleRepository = require('../repositories/schedule.repository');
const Room = require('../models/Room');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// GET /api/room?branchId=&page=&limit=
async function list(req, res) {
  const filter = {};
  if (req.query.branchId) filter.cinema_id = Number(req.query.branchId);
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await roomRepository.findAll(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/room { name, cinema_id, code, type, capacity } (room.create permission, owner-scoped)
async function create(req, res) {
  const { name, cinema_id, code, type, capacity } = req.body;
  if (!name || !cinema_id || !code || capacity === undefined) {
    return res.status(400).json({ message: 'name, cinema_id, code and capacity are required' });
  }
  if (!Number.isInteger(Number(capacity)) || Number(capacity) <= 0) {
    return res.status(400).json({ message: 'capacity must be a positive integer', code: 'INVALID_CAPACITY' });
  }
  if (type !== undefined && !Room.TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of ${Room.TYPES.join(', ')}`, code: 'INVALID_ROOM_TYPE' });
  }

  const duplicate = await roomRepository.findByCinemaAndCode(cinema_id, code);
  if (duplicate) {
    return res.status(409).json({ message: 'This branch already has a room with that code', code: 'ROOM_CODE_TAKEN' });
  }

  const id = await nextId('room');
  const room = await roomRepository.create({
    id,
    cinema_id: Number(cinema_id),
    name,
    code,
    type: type || '2D',
    capacity: Number(capacity),
  });
  res.status(201).json(room);
}

// PUT /api/room/:id { name, code, type, capacity, status } (room.update permission, owner-scoped)
async function update(req, res) {
  const existing = await roomRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Room not found' });

  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;

  if (req.body.code !== undefined) {
    if (!req.body.code) return res.status(400).json({ message: 'code cannot be empty', code: 'INVALID_CODE' });
    const duplicate = await roomRepository.findByCinemaAndCode(existing.cinema_id, req.body.code, {
      excludeId: existing.id,
    });
    if (duplicate) {
      return res.status(409).json({ message: 'This branch already has a room with that code', code: 'ROOM_CODE_TAKEN' });
    }
    updates.code = req.body.code;
  }

  if (req.body.type !== undefined) {
    if (!Room.TYPES.includes(req.body.type)) {
      return res.status(400).json({ message: `type must be one of ${Room.TYPES.join(', ')}`, code: 'INVALID_ROOM_TYPE' });
    }
    updates.type = req.body.type;
  }

  if (req.body.capacity !== undefined) {
    if (!Number.isInteger(Number(req.body.capacity)) || Number(req.body.capacity) <= 0) {
      return res.status(400).json({ message: 'capacity must be a positive integer', code: 'INVALID_CAPACITY' });
    }
    updates.capacity = Number(req.body.capacity);
  }

  if (req.body.status !== undefined) {
    if (!Room.STATUSES.includes(req.body.status)) {
      return res
        .status(400)
        .json({ message: `status must be one of ${Room.STATUSES.join(', ')}`, code: 'INVALID_ROOM_STATUS' });
    }
    updates.status = req.body.status;
  }

  const room = await roomRepository.updateFields(existing.id, updates);
  res.json(room);
}

// DELETE /api/room/:id (room.delete permission, owner-scoped)
async function remove(req, res) {
  const existing = await roomRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Room not found' });

  const hasShowtimes = await scheduleRepository.existsActiveByRoomId(existing.id);
  if (hasShowtimes) {
    return res.status(409).json({
      message: 'This room still has showtimes scheduled against it',
      code: 'ROOM_HAS_SHOWTIMES',
    });
  }

  await seatRepository.deleteByRoomId(existing.id);
  await roomRepository.remove(existing.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
