const Voucher = require('../models/Voucher');
const Branch = require('../models/Branch');

async function findOwnedbranchIds(accountId) {
  const ownedBranches = await Branch.find({ owner_id: accountId });
  return ownedBranches.map((c) => c.id);
}

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Voucher.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Voucher.countDocuments(filter),
  ]);
  return { data, total };
}

async function findByCode(code) {
  return Voucher.findOne({ code: String(code).toUpperCase(), active: true });
}

async function findById(id) {
  return Voucher.findOne({ id: Number(id) });
}

async function findCinemaById(branchId) {
  return Branch.findOne({ id: branchId });
}

async function create(data) {
  return Voucher.create(data);
}

async function updateFields(id, updates) {
  return Voucher.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Voucher.deleteOne({ id: Number(id) });
}

module.exports = {
  findOwnedbranchIds,
  findFiltered,
  findByCode,
  findById,
  findCinemaById,
  create,
  updateFields,
  remove,
};
