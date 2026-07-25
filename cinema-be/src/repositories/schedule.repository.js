const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Cinema = require('../models/Cinema');

async function findAll() {
  return Schedule.find().sort({ id: -1 });
}

async function findForOwner(accountId) {
  const ownedCinemas = await Cinema.find({ owner_id: accountId });
  const rooms = await Room.find({ cinema_id: { $in: ownedCinemas.map((c) => c.id) } });
  return Schedule.find({ room_id: { $in: rooms.map((r) => r.id) } }).sort({ id: -1 });
}

async function findById(id) {
  return Schedule.findOne({ id: Number(id) });
}

async function create(data) {
  return Schedule.create(data);
}

module.exports = { findAll, findForOwner, findById, create };
