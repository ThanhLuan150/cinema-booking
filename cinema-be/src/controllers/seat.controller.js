const seatRepository = require('../repositories/seat.repository');
const roomRepository = require('../repositories/room.repository');
const Seat = require('../models/Seat');
const nextId = require('../utils/nextId');

// GET /api/seat/room/:roomId -> seat map for a room (public — needed to render the seat picker
// and to let customers see seat availability/status before booking)
async function listByRoom(req, res) {
  const seats = await seatRepository.findByRoomId(req.params.roomId);
  res.json(seats);
}

// POST /api/seat/room/:roomId/generate { rows, seatsPerRow, vipRows, coupleRows } -> (re)creates the seat map
async function generate(req, res) {
  const roomId = Number(req.params.roomId);
  const { rows, seatsPerRow, vipRows = [], coupleRows = [] } = req.body;
  if (!Array.isArray(rows) || rows.length === 0 || seatsPerRow === undefined) {
    return res.status(400).json({ message: 'rows (array) and seatsPerRow are required' });
  }
  if (!Number.isInteger(Number(seatsPerRow)) || Number(seatsPerRow) <= 0) {
    return res.status(400).json({ message: 'seatsPerRow must be a positive integer', code: 'INVALID_SEATS_PER_ROW' });
  }
  if (rows.some((row) => typeof row !== 'string' || !row.trim())) {
    return res.status(400).json({ message: 'rows must contain non-empty row labels', code: 'INVALID_ROWS' });
  }

  await seatRepository.deleteByRoomId(roomId);

  const seats = [];
  for (const row of rows) {
    const seatType = vipRows.includes(row) ? 1 : coupleRows.includes(row) ? 2 : 0;
    for (let col = 1; col <= Number(seatsPerRow); col += 1) {
      const id = await nextId('seat');
      seats.push({
        id,
        room_id: roomId,
        row,
        number: col,
        seat_code: `${row}${col}`,
        seat_type: seatType,
        status: 'ACTIVE',
      });
    }
  }
  const created = await seatRepository.insertMany(seats);
  await roomRepository.updateFields(roomId, { capacity: created.length });
  res.status(201).json(created);
}

// PUT /api/seat/:id { seat_type, status } (owner/admin)
async function update(req, res) {
  if (req.body.status !== undefined && !Seat.STATUSES.includes(req.body.status)) {
    return res
      .status(400)
      .json({ message: `status must be one of ${Seat.STATUSES.join(', ')}`, code: 'INVALID_SEAT_STATUS' });
  }

  const fields = ['seat_type', 'status'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const seat = await seatRepository.updateFields(req.params.id, updates);
  if (!seat) return res.status(404).json({ message: 'Seat not found' });
  res.json(seat);
}

module.exports = { listByRoom, generate, update };
