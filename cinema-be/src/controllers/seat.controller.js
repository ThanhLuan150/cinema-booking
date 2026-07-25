const seatRepository = require('../repositories/seat.repository');
const nextId = require('../utils/nextId');

// GET /api/seat/room/:roomId -> seat map for a room (public — needed to render the seat picker)
async function listByRoom(req, res) {
  const seats = await seatRepository.findByRoomId(req.params.roomId);
  res.json(seats);
}

// POST /api/seat/room/:roomId/generate { rows, seatsPerRow, vipRows, coupleRows } -> (re)creates the seat map
async function generate(req, res) {
  const roomId = Number(req.params.roomId);
  const { rows, seatsPerRow, vipRows = [], coupleRows = [] } = req.body;
  if (!Array.isArray(rows) || rows.length === 0 || !seatsPerRow) {
    return res.status(400).json({ message: 'rows (array) and seatsPerRow are required' });
  }

  await seatRepository.deleteByRoomId(roomId);

  const seats = [];
  for (const row of rows) {
    const seatType = vipRows.includes(row) ? 1 : coupleRows.includes(row) ? 2 : 0;
    for (let col = 1; col <= Number(seatsPerRow); col += 1) {
      const id = await nextId('seat');
      seats.push({ id, room_id: roomId, seat_code: `${row}${col}`, seat_type: seatType, is_locked: false });
    }
  }
  const created = await seatRepository.insertMany(seats);
  res.status(201).json(created);
}

// PUT /api/seat/:id { seat_type, is_locked } (owner/admin)
async function update(req, res) {
  const fields = ['seat_type', 'is_locked'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const seat = await seatRepository.updateFields(req.params.id, updates);
  if (!seat) return res.status(404).json({ message: 'Seat not found' });
  res.json(seat);
}

module.exports = { listByRoom, generate, update };
