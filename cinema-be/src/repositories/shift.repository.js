const Shift = require('../models/Shift');

async function findAll(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Shift.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Shift.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Shift.findOne({ id: Number(id) });
}

async function findBranchIdByShiftId(id) {
  const shift = await Shift.findOne({ id: Number(id) });
  return shift ? shift.branch_id : null;
}

async function findByIds(ids) {
  return Shift.find({ id: { $in: ids } });
}

async function create(data) {
  return Shift.create(data);
}

async function updateFields(id, updates) {
  return Shift.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Shift.deleteOne({ id: Number(id) });
}

module.exports = { findAll, findById, findBranchIdByShiftId, findByIds, create, updateFields, remove };
