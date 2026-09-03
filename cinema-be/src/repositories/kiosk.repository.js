const Kiosk = require('../models/Kiosk');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Kiosk.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Kiosk.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Kiosk.findOne({ id: Number(id) });
}

async function findByKioskCode(kioskCode) {
  return Kiosk.findOne({ kiosk_code: String(kioskCode) });
}

async function findByApiKeyHash(hash) {
  return Kiosk.findOne({ api_key_hash: hash });
}

async function findBranchIdByKioskId(id) {
  const kiosk = await Kiosk.findOne({ id: Number(id) });
  return kiosk ? kiosk.branch_id : null;
}

async function create(data) {
  return Kiosk.create(data);
}

async function updateFields(id, updates) {
  return Kiosk.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function touchLastSeen(id, when = new Date()) {
  return Kiosk.updateOne({ id: Number(id) }, { $set: { last_seen_at: when } });
}

async function remove(id) {
  return Kiosk.deleteOne({ id: Number(id) });
}

module.exports = {
  findFiltered,
  findById,
  findByKioskCode,
  findByApiKeyHash,
  findBranchIdByKioskId,
  create,
  updateFields,
  touchLastSeen,
  remove,
};
