const Schedule = require('../models/Schedule');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');

// The set of branch ids this account may act on under BRANCH scope: any branch it owns,
// plus the single branch it's actively staffed at (if any). Used to filter showtime
// listings for a Branch Admin/Employee without hardcoding a role check — the caller decides
// whether BRANCH scope applies (via req.permissionScope) and only then asks "which branches".
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
async function findFiltered({ scope, accessibleCinemaIds = [], cinemaId, roomId, skip = 0, limit = 20 }) {
  const filter = {};
  if (roomId) filter.room_id = Number(roomId);
  if (cinemaId) filter.cinema_id = Number(cinemaId);

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
  resolveAccessibleCinemaIds,
  findFiltered,
  findById,
  findCinemaIdByScheduleId,
  existsActiveByRoomId,
  findOverlapping,
  create,
  updateFields,
  remove,
};
