const Room = require('../models/Room');

async function findCinemaIdByRoomId(roomId) {
  const room = await Room.findOne({ id: Number(roomId) });
  return room ? room.cinema_id : null;
}

async function findById(id) {
  return Room.findOne({ id: Number(id) });
}

async function findAll(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Room.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Room.countDocuments(filter),
  ]);
  return { data, total };
}

async function create({ id, cinema_id, name }) {
  return Room.create({ id, cinema_id, name });
}

async function updateFields(id, updates) {
  return Room.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Room.deleteOne({ id: Number(id) });
}

module.exports = { findCinemaIdByRoomId, findById, findAll, create, updateFields, remove };
