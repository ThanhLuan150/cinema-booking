const Position = require('../models/Position');

async function findByCode(code) {
  return Position.findOne({ code });
}

async function findById(id) {
  return Position.findOne({ id: Number(id) });
}

async function findActiveById(id) {
  return Position.findOne({ id: Number(id), status: 1 });
}

async function findAll({ activeOnly = false } = {}) {
  const filter = activeOnly ? { status: 1 } : {};
  return Position.find(filter).sort({ id: 1 });
}

async function create({ id, code, name, status }) {
  return Position.create({ id, code, name, status });
}

module.exports = { findByCode, findById, findActiveById, findAll, create };
