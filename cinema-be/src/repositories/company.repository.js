const Company = require('../models/Company');
const Branch = require('../models/Branch');

async function findAll({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Company.find().sort({ id: -1 }).skip(skip).limit(limit),
    Company.countDocuments(),
  ]);
  return { data, total };
}

async function findById(id) {
  return Company.findOne({ id: Number(id) });
}

async function findByCode(code) {
  return Company.findOne({ code: String(code).toUpperCase() });
}

async function create(data) {
  return Company.create(data);
}

async function updateFields(id, updates) {
  return Company.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function hasBranches(id) {
  return (await Branch.countDocuments({ company_id: Number(id) })) > 0;
}

async function remove(id) {
  return Company.deleteOne({ id: Number(id) });
}

module.exports = { findAll, findById, findByCode, create, updateFields, hasBranches, remove };
