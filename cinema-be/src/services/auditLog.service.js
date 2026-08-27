const auditLogRepository = require('../repositories/auditLog.repository');
const AuditLog = require('../models/AuditLog');

async function recordAudit({
  req = null,
  action,
  entityType,
  entityId,
  branchId = null,
  performedBy,
  reason = null,
  metadata = null,
}) {
  try {
    const actor = performedBy !== undefined ? performedBy : req && req.account ? req.account.accountId : null;
    await auditLogRepository.create({
      entityType,
      entityId,
      action,
      performedBy: actor ?? null,
      branchId: branchId ?? null,
      reason: reason ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error('[auditLog] failed to record', action, entityType, entityId, err.message);
  }
}

module.exports = {
  recordAudit,
  ACTION: AuditLog.ACTION,
  ENTITY_TYPE: AuditLog.ENTITY_TYPE,
};
