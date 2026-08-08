const Actor = require('../models/Actor');

async function findAll({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Actor.find().sort({ id: -1 }).skip(skip).limit(limit),
    Actor.countDocuments(),
  ]);
  return { data, total };
}

async function findByIds(ids) {
  return Actor.find({ id: { $in: ids } });
}

async function findById(id) {
  return Actor.findOne({ id: Number(id) });
}

async function create({ id, full_name, avatar_url, bio, dob, nationality }) {
  return Actor.create({ id, full_name, avatar_url, bio, dob, nationality });
}

async function updateFields(id, updates) {
  return Actor.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Actor.deleteOne({ id: Number(id) });
}

module.exports = { findAll, findByIds, findById, create, updateFields, remove };
