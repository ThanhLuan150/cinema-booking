const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Cinema = require('../models/Cinema');

// Lists schedules for management (admin sees every showtime; a theater owner only sees
// showtimes in rooms belonging to their own cinema(s)). `cinemaId`/`roomId` narrow the result
// to a single cinema/room, resolved to a room_id filter since Schedule only stores room_id.
async function findFiltered({ role, accountId, cinemaId, roomId, skip = 0, limit = 20 }) {
  const filter = {};

  if (roomId) {
    filter.room_id = Number(roomId);
  } else if (role === 2) {
    const ownedCinemas = await Cinema.find({ owner_id: accountId });
    const cinemaIds = cinemaId
      ? ownedCinemas.map((c) => c.id).filter((id) => id === Number(cinemaId))
      : ownedCinemas.map((c) => c.id);
    const rooms = await Room.find({ cinema_id: { $in: cinemaIds } });
    filter.room_id = { $in: rooms.map((r) => r.id) };
  } else if (cinemaId) {
    const rooms = await Room.find({ cinema_id: Number(cinemaId) });
    filter.room_id = { $in: rooms.map((r) => r.id) };
  }

  const [data, total] = await Promise.all([
    Schedule.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Schedule.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Schedule.findOne({ id: Number(id) });
}

async function create(data) {
  return Schedule.create(data);
}

module.exports = { findFiltered, findById, create };
