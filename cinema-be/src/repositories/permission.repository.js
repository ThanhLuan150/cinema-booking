const Permission = require('../models/Permission');

async function findByCode(code) {
  return Permission.findOne({ code });
}

async function findAll() {
  return Permission.find().sort({ id: 1 });
}

async function create({ id, code, module, description }) {
  return Permission.create({ id, code, module, description });
}

module.exports = { findByCode, findAll, create };
