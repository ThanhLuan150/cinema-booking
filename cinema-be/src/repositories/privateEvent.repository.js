const PrivateEvent = require('../models/PrivateEvent');
const EventPackage = require('../models/EventPackage');
const Schedule = require('../models/Schedule');

// ---- Private events -----------------------------------------------------

async function findEvents(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    PrivateEvent.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    PrivateEvent.countDocuments(filter),
  ]);
  return { data, total };
}

async function findEventById(id) {
  return PrivateEvent.findOne({ id: Number(id) });
}

async function findBranchIdByEventId(id) {
  const event = await PrivateEvent.findOne({ id: Number(id) });
  return event ? event.branch_id : null;
}

async function createEvent(data) {
  return PrivateEvent.create(data);
}

async function updateEvent(id, updates) {
  return PrivateEvent.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

// Atomic status step: only applies `updates` while the event is still in `fromStatus`, so two
// racing transitions on the same event can't both take effect (the loser matches nothing).
async function transitionEvent(id, fromStatus, updates) {
  const from = Array.isArray(fromStatus) ? { $in: fromStatus } : fromStatus;
  return PrivateEvent.findOneAndUpdate({ id: Number(id), status: from }, { $set: updates }, { new: true });
}

// ---- Conflict-detection candidate rows --------------------------------

// Non-cancelled showtimes for a room on any of the given local date strings. The caller
// filters these down to the ones whose local [begin, end) actually overlaps the request.
async function findRoomSchedules(roomId, dateStrs) {
  if (!dateStrs || dateStrs.length === 0) return [];
  return Schedule.find({
    room_id: Number(roomId),
    movie_date: { $in: dateStrs },
    status: { $ne: 'CANCELLED' },
  });
}

// Every still-active private event in a room (any status but CANCELLED). Small set per room;
// the overlap test is done in memory by the caller via eventWindow.findEventConflict.
async function findRoomBlockingEvents(roomId, { excludeId } = {}) {
  const filter = { room_id: Number(roomId), status: { $in: PrivateEvent.BLOCKING_STATUSES } };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return PrivateEvent.find(filter);
}

// ---- Event packages --------------------------------------------------

async function findPackages(filter, { skip = 0, limit = 50 } = {}) {
  const [data, total] = await Promise.all([
    EventPackage.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    EventPackage.countDocuments(filter),
  ]);
  return { data, total };
}

async function findPackageById(id) {
  return EventPackage.findOne({ id: Number(id) });
}

async function findPackageByCode(code, { excludeId } = {}) {
  const filter = { code: String(code).toUpperCase() };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return EventPackage.findOne(filter);
}

async function createPackage(data) {
  return EventPackage.create(data);
}

async function updatePackage(id, updates) {
  return EventPackage.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function removePackage(id) {
  return EventPackage.deleteOne({ id: Number(id) });
}

async function countEventsForPackage(packageId) {
  return PrivateEvent.countDocuments({ package_id: Number(packageId) });
}

module.exports = {
  findEvents,
  findEventById,
  findBranchIdByEventId,
  createEvent,
  updateEvent,
  transitionEvent,
  findRoomSchedules,
  findRoomBlockingEvents,
  findPackages,
  findPackageById,
  findPackageByCode,
  createPackage,
  updatePackage,
  removePackage,
  countEventsForPackage,
};
