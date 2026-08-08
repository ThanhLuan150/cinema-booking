const Account = require('../models/Account');
const Branch = require('../models/Branch');

async function findById(id) {
  return Account.findOne({ id: Number(id) });
}

async function updateOwnProfile(accountId, updates) {
  return Account.findOneAndUpdate({ id: accountId }, { $set: updates }, { new: true });
}

async function findAll({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Account.find().sort({ id: -1 }).skip(skip).limit(limit),
    Account.countDocuments(),
  ]);
  return { data, total };
}

async function remove(id) {
  return Account.deleteOne({ id: Number(id) });
}

async function updateFields(id, updates) {
  return Account.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}
async function approveOwnedPendingCinemas(ownerId) {
  return Branch.updateMany({ owner_id: ownerId, status: 'INACTIVE' }, { $set: { status: 'ACTIVE' } });
}

module.exports = { findById, updateOwnProfile, findAll, remove, updateFields, approveOwnedPendingCinemas };
