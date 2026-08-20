const Room = require('../models/Room');

async function findCinemaIdByRoomId(roomId) {
  const room = await Room.findOne({ id: Number(roomId) });
  return room ? room.cinema_id : null;
}

async function findById(id) {
  return Room.findOne({ id: Number(id) });
}

// Used to enforce "room code is unique within its branch". excludeId skips the room being
// edited so an update doesn't collide with itself.
async function findByCinemaAndCode(cinema_id, code, { excludeId } = {}) {
  const filter = { cinema_id: Number(cinema_id), code };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return Room.findOne(filter);
}

async function findAll(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Room.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Room.countDocuments(filter),
  ]);
  return { data, total };
}

async function create(data) {
  return Room.create(data);
}

async function updateFields(id, updates) {
  return Room.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Room.deleteOne({ id: Number(id) });
}

module.exports = {
  findCinemaIdByRoomId,
  findById,
  findByCinemaAndCode,
  findAll,
  create,
  updateFields,
  remove,
};
