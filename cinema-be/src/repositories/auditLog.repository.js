const AuditLog = require('../models/AuditLog');
const nextId = require('../utils/nextId');

// Ticket 15 + Ticket 24: the append-only trail of who did what. `create` is the ONLY write path
// (the model rejects every update/delete). Ticket 24 added `branchId` for branch-scoped reads
// and the query helpers below that power the admin audit-log viewer.
async function create({
  entityType,
  entityId,
  action,
  performedBy = null,
  branchId = null,
  reason = null,
  metadata = null,
}) {
  return AuditLog.create({
    id: await nextId('auditLog'),
    entity_type: entityType,
    entity_id: entityId,
    action,
    performed_by: performedBy,
    branch_id: branchId,
    reason,
    metadata,
  });
}

// Builds the mongo filter for the viewer. `branchIds` (array) restricts to a set of branches —
// used for a BRANCH-scoped caller; `branchId` (scalar) is the optional single-branch filter an
// ALL-scoped caller may pass.
function buildFilter({ branchId, branchIds, entityType, entityId, action, performedBy, from, to } = {}) {
  const filter = {};
  if (Array.isArray(branchIds)) filter.branch_id = { $in: branchIds };
  else if (branchId !== undefined && branchId !== null && branchId !== '') filter.branch_id = Number(branchId);
  if (entityType) filter.entity_type = entityType;
  if (entityId !== undefined && entityId !== null && entityId !== '') filter.entity_id = Number(entityId);
  if (action) filter.action = action;
  if (performedBy !== undefined && performedBy !== null && performedBy !== '') filter.performed_by = Number(performedBy);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  return filter;
}

async function findFiltered(criteria = {}, { skip = 0, limit = 20 } = {}) {
  const filter = buildFilter(criteria);
  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return AuditLog.findOne({ id: Number(id) });
}

module.exports = { create, findFiltered, findById, buildFilter };
