const Device = require('../models/Device');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Device.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Device.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Device.findOne({ id: Number(id) });
}

async function findByDeviceId(deviceId) {
  return Device.findOne({ device_id: String(deviceId) });
}

async function findByApiKeyHash(hash) {
  return Device.findOne({ api_key_hash: hash });
}

async function findBranchIdByDeviceId(id) {
  const device = await Device.findOne({ id: Number(id) });
  return device ? device.branch_id : null;
}

async function create(data) {
  return Device.create(data);
}

async function updateFields(id, updates) {
  return Device.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function touchLastSeen(id, when = new Date()) {
  return Device.updateOne({ id: Number(id) }, { $set: { last_seen_at: when } });
}

async function remove(id) {
  return Device.deleteOne({ id: Number(id) });
}

module.exports = {
  findFiltered,
  findById,
  findByDeviceId,
  findByApiKeyHash,
  findBranchIdByDeviceId,
  create,
  updateFields,
  touchLastSeen,
  remove,
};
