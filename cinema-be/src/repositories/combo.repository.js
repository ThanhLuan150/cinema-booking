const Combo = require('../models/Combo');
const Branch = require('../models/Branch');

async function findbranchIdByComboId(comboId) {
  const combo = await Combo.findOne({ id: Number(comboId) });
  return combo ? combo.cinema_id : null;
}

async function findActiveBybranchId(branchId, { skip = 0, limit = 20 } = {}) {
  const filter = { active: true, cinema_id: Number(branchId) };
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findBybranchIds(branchIds, { skip = 0, limit = 20 } = {}) {
  const filter = { cinema_id: { $in: branchIds } };
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findAll({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Combo.find().sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(),
  ]);
  return { data, total };
}

async function findActive({ skip = 0, limit = 20 } = {}) {
  const filter = { active: true };
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Combo.findOne({ id: Number(id) });
}

async function findOwnedbranchIds(accountId) {
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
  findbranchIdByComboId,
  findActiveBybranchId,
  findBybranchIds,
  findAll,
  findActive,
  findById,
  findOwnedbranchIds,
  create,
  updateFields,
  remove,
};
