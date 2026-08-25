const AuditLog = require('../models/AuditLog');
const nextId = require('../utils/nextId');

// Ticket 15: persists a trail of who cancelled/rescheduled what and why. Write-only for now —
// no admin viewer endpoint exists yet, this is the source of truth for a future one.
async function create({ entityType, entityId, action, performedBy = null, reason = null, metadata = null }) {
  return AuditLog.create({
    id: await nextId('auditLog'),
    entity_type: entityType,
    entity_id: entityId,
    action,
    performed_by: performedBy,
    reason,
    metadata,
  });
}

module.exports = { create };
