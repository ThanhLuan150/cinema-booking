const auditLogRepository = require('../repositories/auditLog.repository');
const AuditLog = require('../models/AuditLog');
const { emitToAdmin, emitToBranch } = require('../utils/socket');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');

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
    // The audit viewer is a live tail, and its readers are exactly the rooms the stored row is
    // already scoped to (branch-scoped for a Branch Admin, everything for SUPER_ADMIN). The
    // emit carries no reason/metadata — those can hold operator notes, and the viewer endpoint
    // is where the permission check for them lives.
    const payload = { action, entityType, entityId, branchId: branchId ?? null, performedBy: actor ?? null };
    emitToAdmin(REALTIME_EVENT.AUDIT_LOG_NEW, payload);
    if (branchId !== null && branchId !== undefined) emitToBranch(branchId, REALTIME_EVENT.AUDIT_LOG_NEW, payload);
  } catch (err) {
    console.error('[auditLog] failed to record', action, entityType, entityId, err.message);
  }
}

module.exports = {
  recordAudit,
  ACTION: AuditLog.ACTION,
  ENTITY_TYPE: AuditLog.ENTITY_TYPE,
};
