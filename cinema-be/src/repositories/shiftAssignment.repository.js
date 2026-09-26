const ShiftAssignment = require('../models/ShiftAssignment');

async function findAll(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    ShiftAssignment.find(filter).sort({ date: -1, id: -1 }).skip(skip).limit(limit),
    ShiftAssignment.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return ShiftAssignment.findOne({ id: Number(id) });
}

async function findBranchIdByAssignmentId(id) {
  const assignment = await ShiftAssignment.findOne({ id: Number(id) });
  return assignment ? assignment.branch_id : null;
}

// True if this employee already has a non-cancelled assignment to this shift on this date.
// `excludeId` skips the assignment being edited so an update doesn't collide with itself.
async function findActiveDuplicate({ employee_id, shift_id, date, excludeId }) {
  const filter = {
    employee_id: Number(employee_id),
    shift_id: Number(shift_id),
    date,
    status: 'ACTIVE',
  };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return ShiftAssignment.findOne(filter);
}

// The employee's live assignment whose time range intersects [start_at, end_at), or null.
// Half-open on both sides, so back-to-back shifts (one ends exactly when the next starts) don't
// conflict. Compares absolute instants rather than `date`, so it also catches an overnight shift
// spilling into the next calendar day.
async function findOverlapping({ employee_id, start_at, end_at, excludeId }) {
  const filter = {
    employee_id: Number(employee_id),
    status: 'ACTIVE',
    start_at: { $lt: end_at },
    end_at: { $gt: start_at },
  };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return ShiftAssignment.findOne(filter).sort({ start_at: 1 });
}

// The employee's live roster entries for one calendar day (used by attendance to work out
// whether a clock-in is late).
async function findActiveForEmployeeOnDate(employeeId, date) {
  return ShiftAssignment.find({ employee_id: Number(employeeId), date, status: 'ACTIVE' }).sort({ start_at: 1 });
}

// Live assignments that ended inside [after, before) — the candidates for an absence check.
// The lower bound keeps the sweep from re-scanning the whole roster history every run.
async function findActiveEndedBetween(after, before) {
  return ShiftAssignment.find({ status: 'ACTIVE', end_at: { $gte: after, $lt: before } });
}

async function existsForShift(shiftId) {
  return ShiftAssignment.exists({ shift_id: Number(shiftId) });
}

async function create(data) {
  return ShiftAssignment.create(data);
}

async function updateFields(id, updates) {
  return ShiftAssignment.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return ShiftAssignment.deleteOne({ id: Number(id) });
}

module.exports = {
  findAll,
  findById,
  findBranchIdByAssignmentId,
  findActiveDuplicate,
  findOverlapping,
  findActiveForEmployeeOnDate,
  findActiveEndedBetween,
  existsForShift,
  create,
  updateFields,
  remove,
};
