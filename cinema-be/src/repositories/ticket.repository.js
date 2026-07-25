const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Seat = require('../models/Seat');

async function countByScheduleId(scheduleId) {
  return Ticket.countDocuments({ schedule_id: Number(scheduleId) });
}

async function findByScheduleId(scheduleId) {
  return Ticket.find({ schedule_id: Number(scheduleId) }).sort({ seat_index: 1 });
}

async function findScheduleById(id) {
  return Schedule.findOne({ id: Number(id) });
}

async function findSeatMapByRoomId(roomId) {
  return Seat.find({ room_id: roomId }).sort({ id: 1 });
}

async function insertMany(tickets) {
  return Ticket.insertMany(tickets);
}

async function markSold(id) {
  return Ticket.findOneAndUpdate({ id: Number(id) }, { $set: { status: 0 } }, { new: true });
}

module.exports = {
  countByScheduleId,
  findByScheduleId,
  findScheduleById,
  findSeatMapByRoomId,
  insertMany,
  markSold,
};
