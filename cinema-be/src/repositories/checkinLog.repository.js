const CheckinLog = require('../models/CheckinLog');
const nextId = require('../utils/nextId');
const { emitBranchEvent } = require('../utils/socket');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');

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
  const log = await CheckinLog.create({ id, ...entry });

  // Both check-in channels (staff desk and the QR scanners) land here, so this is the one place
  // that has to push the door feed to the branch.
  emitBranchEvent(log.branch_id, REALTIME_EVENT.CHECKIN_NEW, {
    checkinLogId: log.id,
    invoiceId: log.invoice_id ?? null,
    deviceId: log.device_id ?? null,
    entranceId: log.entrance_id ?? null,
    result: log.result,
  });

  return log;
}

module.exports = { findFiltered, record };
