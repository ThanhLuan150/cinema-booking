const Holiday = require('../models/Holiday');
const Branch = require('../models/Branch');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Holiday.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    Holiday.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Holiday.findOne({ id: Number(id) });
}

async function findOwnedCinemaIds(accountId) {
  const ownedBranches = await Branch.find({ owner_id: accountId });
  return ownedBranches.map((c) => c.id);
}

async function create(data) {
  return Holiday.create(data);
}

async function updateFields(id, updates) {
  return Holiday.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Holiday.deleteOne({ id: Number(id) });
}

module.exports = {
  findFiltered,
  findById,
  findOwnedCinemaIds,
  create,
  updateFields,
  remove,
};
