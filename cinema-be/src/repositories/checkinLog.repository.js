const CheckinLog = require('../models/CheckinLog');
const nextId = require('../utils/nextId');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    CheckinLog.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    CheckinLog.countDocuments(filter),
  ]);
  return { data, total };
}

// Best-effort audit write: a logging failure must never turn a valid check-in into an error,
// so callers `await record(...).catch(() => {})`.
async function record(entry) {
  const id = await nextId('checkinLog');
  return CheckinLog.create({ id, ...entry });
}

module.exports = { findFiltered, record };
