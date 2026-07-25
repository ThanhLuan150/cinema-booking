const Category = require('../models/Category');

async function findAll() {
  return Category.find().sort({ id: 1 });
}

async function findById(id) {
  return Category.findOne({ id: Number(id) });
}

async function create({ id, name }) {
  return Category.create({ id, name });
}

module.exports = { findAll, findById, create };
