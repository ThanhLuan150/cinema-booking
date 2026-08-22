const PricingRule = require('../models/PricingRule');
const Branch = require('../models/Branch');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    PricingRule.find(filter).sort({ priority: -1, id: -1 }).skip(skip).limit(limit),
    PricingRule.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return PricingRule.findOne({ id: Number(id) });
}

async function findOwnedCinemaIds(accountId) {
  const ownedBranches = await Branch.find({ owner_id: accountId });
  return ownedBranches.map((c) => c.id);
}

async function create(data) {
  return PricingRule.create(data);
}

async function updateFields(id, updates) {
  return PricingRule.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return PricingRule.deleteOne({ id: Number(id) });
}

module.exports = {
  findFiltered,
  findById,
  findOwnedCinemaIds,
  create,
  updateFields,
  remove,
};
