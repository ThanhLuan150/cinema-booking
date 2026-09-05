const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');
const Branch = require('../models/Branch');

async function findOwnedCinemaIds(accountId) {
  const ownedBranches = await Branch.find({ owner_id: accountId });
  return ownedBranches.map((c) => c.id);
}

async function findCinemaById(branchId) {
  return Branch.findOne({ id: branchId });
}

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    GiftCard.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    GiftCard.countDocuments(filter),
  ]);
  return { data, total };
}

async function findMine(accountId, { skip = 0, limit = 20 } = {}) {
  return findFiltered({ owner_account_id: Number(accountId) }, { skip, limit });
}

async function findById(id) {
  return GiftCard.findOne({ id: Number(id) });
}

// Any status — unlike Voucher.findByCode, admin/service lookups need to see blocked/used cards too.
async function findByCode(code) {
  return GiftCard.findOne({ code: String(code).toUpperCase() });
}

async function create(data) {
  return GiftCard.create(data);
}

async function updateFields(id, updates) {
  return GiftCard.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function findHistory(giftCardId, { skip = 0, limit = 20 } = {}) {
  const filter = { gift_card_id: Number(giftCardId) };
  const [data, total] = await Promise.all([
    GiftCardTransaction.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    GiftCardTransaction.countDocuments(filter),
  ]);
  return { data, total };
}

module.exports = {
  findOwnedCinemaIds,
  findCinemaById,
  findFiltered,
  findMine,
  findById,
  findByCode,
  create,
  updateFields,
  findHistory,
};
