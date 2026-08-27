const Schedule = require('../models/Schedule');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');

const SHOWTIME_BUFFER_MINUTES = 15;

function timeToMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

async function resolveAccessibleCinemaIds(accountId) {
  const [ownedBranches, employee] = await Promise.all([
    Branch.find({ owner_id: accountId }, 'id'),
    Employee.findOne({ user_id: accountId, status: 1 }),
  ]);
  const ids = new Set(ownedBranches.map((c) => c.id));
  if (employee) ids.add(employee.branch_id);
  return [...ids];
}

// Lists schedules for management. `scope` is 'ALL' (super admin — no restriction) or 'BRANCH'
// (restricted to `accessibleCinemaIds`). `cinemaId`/`roomId` narrow the result further.
async function findFiltered({ scope, accessibleCinemaIds = [], cinemaId, roomId, movieId, skip = 0, limit = 20 }) {
  const filter = {};
  if (roomId) filter.room_id = Number(roomId);
  if (cinemaId) filter.cinema_id = Number(cinemaId);
  if (movieId) filter.movie_id = Number(movieId);

  if (scope !== 'ALL') {
    const allowed = cinemaId
      ? accessibleCinemaIds.filter((id) => id === Number(cinemaId))
      : accessibleCinemaIds;
    filter.cinema_id = { $in: allowed };
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

async function findCinemaIdByScheduleId(id) {
  const schedule = await Schedule.findOne({ id: Number(id) });
  return schedule ? schedule.cinema_id : null;
}

// True if `room_id` still has any non-cancelled showtime. Used to block deleting a Room that
// showtimes still depend on.
async function existsActiveByRoomId(room_id) {
  const schedule = await Schedule.findOne({ room_id: Number(room_id), status: { $ne: 'CANCELLED' } });
  return Boolean(schedule);
}

// True if `room_id` already has a non-cancelled showtime overlapping [time_begin, time_end)
// on `movie_date`. `excludeId` skips the schedule being edited so an update doesn't collide
// with itself.
async function findOverlapping({ room_id, movie_date, time_begin, time_end, excludeId }) {
  const filter = {
    room_id: Number(room_id),
    movie_date,
    status: { $ne: 'CANCELLED' },
    time_begin: { $lt: time_end },
    time_end: { $gt: time_begin },
  };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return Schedule.findOne(filter);
}

async function findBufferViolation({ room_id, movie_date, time_begin, time_end, excludeId, bufferMinutes = SHOWTIME_BUFFER_MINUTES }) {
  const filter = { room_id: Number(room_id), movie_date, status: { $ne: 'CANCELLED' } };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  const candidates = await Schedule.find(filter);

  const beginMinutes = timeToMinutes(time_begin);
  const endMinutes = timeToMinutes(time_end);

  return (
    candidates.find((schedule) => {
      const otherBegin = timeToMinutes(schedule.time_begin);
      const otherEnd = timeToMinutes(schedule.time_end);
      const gap = otherEnd <= beginMinutes ? beginMinutes - otherEnd : endMinutes <= otherBegin ? otherBegin - endMinutes : 0;
      return gap < bufferMinutes;
    }) || null
  );
}

async function create(data) {
  return Schedule.create(data);
}

async function updateFields(id, updates) {
  return Schedule.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Schedule.deleteOne({ id: Number(id) });
}

module.exports = {
  SHOWTIME_BUFFER_MINUTES,
  resolveAccessibleCinemaIds,
  findFiltered,
  findById,
  findCinemaIdByScheduleId,
  existsActiveByRoomId,
  findOverlapping,
  findBufferViolation,
  create,
  updateFields,
  remove,
};
