const Promotion = require('../models/Promotion');
const PromotionUsage = require('../models/PromotionUsage');
const Branch = require('../models/Branch');

async function findOwnedCinemaIds(accountId) {
  const ownedBranches = await Branch.find({ owner_id: accountId });
  return ownedBranches.map((c) => c.id);
}

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Promotion.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Promotion.countDocuments(filter),
  ]);
  return { data, total };
}

async function findByCode(code) {
  return Promotion.findOne({ code: String(code).toUpperCase() });
}

async function findById(id) {
  return Promotion.findOne({ id: Number(id) });
}

async function create(data) {
  return Promotion.create(data);
}

async function updateFields(id, updates) {
  return Promotion.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  await PromotionUsage.deleteMany({ promotion_id: Number(id) });
  return Promotion.deleteOne({ id: Number(id) });
}

async function findUsage(promotionId, accountId) {
  return PromotionUsage.findOne({ promotion_id: Number(promotionId), account_id: Number(accountId) });
}

async function recordUsage(promotionId, accountId) {
  await Promotion.updateOne({ id: Number(promotionId) }, { $inc: { used_count: 1 } });
  return PromotionUsage.findOneAndUpdate(
    { promotion_id: Number(promotionId), account_id: Number(accountId) },
    { $inc: { count: 1 } },
    { new: true, upsert: true },
  );
}

module.exports = {
  findOwnedCinemaIds,
  findFiltered,
  findByCode,
  findById,
  create,
  updateFields,
  remove,
  findUsage,
  recordUsage,
};
