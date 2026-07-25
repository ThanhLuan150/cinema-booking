const roomRepository = require('../repositories/room.repository');
const nextId = require('../utils/nextId');

// GET /api/room?cinemaId=
async function list(req, res) {
  const filter = {};
  if (req.query.cinemaId) filter.cinema_id = Number(req.query.cinemaId);
  const rooms = await roomRepository.findAll(filter);
  res.json(rooms);
}

// POST /api/room { name, cinema_id } (admin or theater staff, owner-scoped)
async function create(req, res) {
  const { name, cinema_id } = req.body;
  if (!name || !cinema_id) return res.status(400).json({ message: 'name and cinema_id are required' });

  const id = await nextId('room');
  const room = await roomRepository.create({ id, cinema_id: Number(cinema_id), name });
  res.status(201).json(room);
}

// PUT /api/room/:id { name } (admin or theater staff, owner-scoped)
async function update(req, res) {
  const updates = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  const room = await roomRepository.updateFields(req.params.id, updates);
  if (!room) return res.status(404).json({ message: 'Room not found' });
  res.json(room);
}

// DELETE /api/room/:id (admin or theater staff, owner-scoped)
async function remove(req, res) {
  await roomRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, create, update, remove };
