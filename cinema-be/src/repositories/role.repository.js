const Role = require('../models/Role');

async function findByLegacyNumber(legacyRoleNumber) {
  return Role.findOne({ legacy_role_number: Number(legacyRoleNumber) });
}

async function findByCode(code) {
  return Role.findOne({ code });
}

async function findAll() {
  return Role.find().sort({ id: 1 });
}

async function create({ id, code, legacy_role_number, name }) {
  return Role.create({ id, code, legacy_role_number, name });
}

module.exports = { findByLegacyNumber, findByCode, findAll, create };
