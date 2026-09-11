const Integration = require('../models/Integration');

async function findFiltered(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Integration.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Integration.countDocuments(filter),
  ]);
  return { data, total };
}

async function findAll(filter = {}) {
  return Integration.find(filter).sort({ name: 1 });
}

async function findById(id) {
  return Integration.findOne({ id: Number(id) });
}

async function findByProvider(provider) {
  if (!provider) return null;
  return Integration.findOne({ provider: String(provider).toUpperCase().trim() });
}

async function create(data) {
  return Integration.create(data);
}

async function updateFields(id, updates) {
  return Integration.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Integration.deleteOne({ id: Number(id) });
}

module.exports = { findFiltered, findAll, findById, findByProvider, create, updateFields, remove };
