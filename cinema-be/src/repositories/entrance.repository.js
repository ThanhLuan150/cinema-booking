const Entrance = require('../models/Entrance');
const Device = require('../models/Device');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Entrance.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Entrance.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Entrance.findOne({ id: Number(id) });
}

async function findBranchIdByEntranceId(id) {
  const entrance = await Entrance.findOne({ id: Number(id) });
  return entrance ? entrance.branch_id : null;
}

// "code is unique within its branch" — excludeId skips the entrance being updated.
async function findByBranchAndCode(branchId, code, { excludeId } = {}) {
  const filter = { branch_id: Number(branchId), code };
  if (excludeId !== undefined) filter.id = { $ne: Number(excludeId) };
  return Entrance.findOne(filter);
}

async function create(data) {
  return Entrance.create(data);
}

async function updateFields(id, updates) {
  return Entrance.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Entrance.deleteOne({ id: Number(id) });
}

// A device is still pinned here — deleting the entrance would orphan its entrance_id.
async function countDevices(entranceId) {
  return Device.countDocuments({ entrance_id: Number(entranceId) });
}

module.exports = {
  findFiltered,
  findById,
  findBranchIdByEntranceId,
  findByBranchAndCode,
  create,
  updateFields,
  remove,
  countDevices,
};
