const Combo = require('../models/Combo');
const Branch = require('../models/Branch');

async function findCinemaIdByComboId(comboId) {
  const combo = await Combo.findOne({ id: Number(comboId) });
  return combo ? combo.cinema_id : null;
}

async function findActiveByCinemaId(branchId, { skip = 0, limit = 20, type } = {}) {
  const filter = { active: true, cinema_id: Number(branchId) };
  if (type) filter.type = type;
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findByCinemaIds(branchIds, { skip = 0, limit = 20, type } = {}) {
  const filter = { cinema_id: { $in: branchIds } };
  if (type) filter.type = type;
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findAll({ skip = 0, limit = 20, type } = {}) {
  const filter = {};
  if (type) filter.type = type;
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findActive({ skip = 0, limit = 20, type } = {}) {
  const filter = { active: true };
  if (type) filter.type = type;
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Combo.findOne({ id: Number(id) });
}

async function findByIds(ids) {
  return Combo.find({ id: { $in: ids.map(Number) } });
}

async function findOwnedCinemaIds(accountId) {
  const ownedBranches = await Branch.find({ owner_id: accountId });
  return ownedBranches.map((c) => c.id);
}

async function create(data) {
  return Combo.create(data);
}

async function updateFields(id, updates) {
  return Combo.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Combo.deleteOne({ id: Number(id) });
}

module.exports = {
  findCinemaIdByComboId,
  findActiveByCinemaId,
  findByCinemaIds,
  findAll,
  findActive,
  findById,
  findByIds,
  findOwnedCinemaIds,
  create,
  updateFields,
  remove,
};
