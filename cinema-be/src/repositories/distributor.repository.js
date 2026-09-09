const Distributor = require('../models/Distributor');

async function findFiltered(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Distributor.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Distributor.countDocuments(filter),
  ]);
  return { data, total };
}

async function findAll(filter = {}) {
  return Distributor.find(filter).sort({ name: 1 });
}

async function findById(id) {
  return Distributor.findOne({ id: Number(id) });
}

async function findByCode(code) {
  return Distributor.findOne({ code: String(code).toUpperCase().trim() });
}

async function create(data) {
  return Distributor.create(data);
}

async function updateFields(id, updates) {
  return Distributor.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Distributor.deleteOne({ id: Number(id) });
}

module.exports = { findFiltered, findAll, findById, findByCode, create, updateFields, remove };
