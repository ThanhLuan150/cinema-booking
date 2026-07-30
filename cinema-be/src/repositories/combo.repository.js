const Combo = require('../models/Combo');
const Cinema = require('../models/Cinema');

async function findCinemaIdByComboId(comboId) {
  const combo = await Combo.findOne({ id: Number(comboId) });
  return combo ? combo.cinema_id : null;
}

async function findActiveByCinemaId(cinemaId, { skip = 0, limit = 20 } = {}) {
  const filter = { active: true, cinema_id: Number(cinemaId) };
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findByCinemaIds(cinemaIds, { skip = 0, limit = 20 } = {}) {
  const filter = { cinema_id: { $in: cinemaIds } };
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
}

async function findAll({ skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Combo.find().sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(),
  ]);
  return { data, total };
}

async function findActive({ skip = 0, limit = 20 } = {}) {
  const filter = { active: true };
  const [data, total] = await Promise.all([
    Combo.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Combo.countDocuments(filter),
  ]);
  return { data, total };
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
