const Supplier = require('../models/Supplier');

async function findFiltered(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Supplier.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);
  return { data, total };
}

async function findAll(filter = {}) {
  return Supplier.find(filter).sort({ name: 1 });
}

async function findById(id) {
  return Supplier.findOne({ id: Number(id) });
}

async function findByIds(ids) {
  return Supplier.find({ id: { $in: ids.map(Number) } });
}

async function findByCode(code) {
  return Supplier.findOne({ code: String(code).toUpperCase().trim() });
}

async function create(data) {
  return Supplier.create(data);
}

async function updateFields(id, updates) {
  return Supplier.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Supplier.deleteOne({ id: Number(id) });
}

module.exports = { findFiltered, findAll, findById, findByIds, findByCode, create, updateFields, remove };
