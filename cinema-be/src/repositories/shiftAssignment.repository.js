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
  existsForShift,
  create,
  updateFields,
  remove,
};
