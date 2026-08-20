const Seat = require('../models/Seat');

async function findByRoomId(roomId) {
  return Seat.find({ room_id: Number(roomId) }).sort({ id: 1 });
}

async function deleteByRoomId(roomId) {
  return Seat.deleteMany({ room_id: Number(roomId) });
}

async function insertMany(seats) {
  return Seat.insertMany(seats);
}

async function findById(id) {
  return Seat.findOne({ id: Number(id) });
}

// Bookable seats only — a room whose seats are all DISABLED can't back a showtime either.
async function countActiveByRoomId(roomId) {
  return Seat.countDocuments({ room_id: Number(roomId), status: 'ACTIVE' });
}

async function updateFields(id, updates) {
  return Seat.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

module.exports = { findByRoomId, deleteByRoomId, insertMany, findById, countActiveByRoomId, updateFields };
