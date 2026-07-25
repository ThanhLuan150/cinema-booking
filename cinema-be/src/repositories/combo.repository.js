const Combo = require('../models/Combo');
const Cinema = require('../models/Cinema');

async function findCinemaIdByComboId(comboId) {
  const combo = await Combo.findOne({ id: Number(comboId) });
  return combo ? combo.cinema_id : null;
}

async function findActiveByCinemaId(cinemaId) {
  return Combo.find({ active: true, cinema_id: Number(cinemaId) }).sort({ id: -1 });
}

async function findByCinemaIds(cinemaIds) {
  return Combo.find({ cinema_id: { $in: cinemaIds } }).sort({ id: -1 });
}

async function findAll() {
  return Combo.find().sort({ id: -1 });
}

async function findActive() {
  return Combo.find({ active: true }).sort({ id: -1 });
}

async function findById(id) {
  return Combo.findOne({ id: Number(id) });
}

async function findOwnedCinemaIds(accountId) {
  const ownedCinemas = await Cinema.find({ owner_id: accountId });
  return ownedCinemas.map((c) => c.id);
}

async function create(data) {
  return Combo.create(data);
}

async function updateFields(id, updates) {
  return Combo.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Combo.deleteOne({ id: Number(id) });
}

module.exports = {
  findCinemaIdByComboId,
  findActiveByCinemaId,
  findByCinemaIds,
  findAll,
  findActive,
  findById,
  findOwnedCinemaIds,
  create,
  updateFields,
  remove,
};
