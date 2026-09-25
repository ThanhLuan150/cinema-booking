const Incident = require('../models/Incident');

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Incident.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Incident.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Incident.findOne({ id: Number(id) });
}

async function findBranchIdByIncidentId(id) {
  const incident = await Incident.findOne({ id: Number(id) });
  return incident ? incident.branch_id : null;
}

async function create(data) {
  return Incident.create(data);
}

module.exports = { findFiltered, findById, findBranchIdByIncidentId, create };
