const Voucher = require('../models/Voucher');
const Cinema = require('../models/Cinema');

async function findOwnedCinemaIds(accountId) {
  const ownedCinemas = await Cinema.find({ owner_id: accountId });
  return ownedCinemas.map((c) => c.id);
}

async function findFiltered(filter) {
  return Voucher.find(filter).sort({ id: -1 });
}

async function findByCode(code) {
  return Voucher.findOne({ code: String(code).toUpperCase(), active: true });
}

async function findById(id) {
  return Voucher.findOne({ id: Number(id) });
}

async function findCinemaById(cinemaId) {
  return Cinema.findOne({ id: cinemaId });
}

async function create(data) {
  return Voucher.create(data);
}

async function updateFields(id, updates) {
  return Voucher.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Voucher.deleteOne({ id: Number(id) });
}

module.exports = {
  findOwnedCinemaIds,
  findFiltered,
  findByCode,
  findById,
  findCinemaById,
  create,
  updateFields,
  remove,
};
