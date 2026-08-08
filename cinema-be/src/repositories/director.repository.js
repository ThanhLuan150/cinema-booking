const Director = require('../models/Director');

async function findAll({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Director.find().sort({ id: -1 }).skip(skip).limit(limit),
    Director.countDocuments(),
  ]);
  return { data, total };
}

async function findByIds(ids) {
  return Director.find({ id: { $in: ids } });
}

async function findById(id) {
  return Director.findOne({ id: Number(id) });
}

async function create({ id, full_name, avatar_url, bio, dob, nationality }) {
  return Director.create({ id, full_name, avatar_url, bio, dob, nationality });
}

async function updateFields(id, updates) {
  return Director.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Director.deleteOne({ id: Number(id) });
}

module.exports = { findAll, findByIds, findById, create, updateFields, remove };
