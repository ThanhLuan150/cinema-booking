const Account = require('../models/Account');
const Branch = require('../models/Branch');

async function findById(id) {
  return Account.findOne({ id: Number(id) });
}

async function updateOwnProfile(accountId, updates) {
  return Account.findOneAndUpdate({ id: accountId }, { $set: updates }, { new: true });
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// q: case-insensitive substring match against name/email/phone (Customer Service account lookup).
async function findAll({ skip = 0, limit = 20, q } = {}) {
  const filter = {};
  if (q && q.trim()) {
    const pattern = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }
  const [data, total] = await Promise.all([
    Account.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Account.countDocuments(filter),
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
