const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const auditLogSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    entity_type: { type: String, enum: ['SCHEDULE', 'BOOKING', 'REFUND'], required: true, index: true },
    entity_id: { type: Number, required: true, index: true },
    action: { type: String, required: true },
    performed_by: { type: Number, default: null }, // account_id, or null for a system/sweep-driven change
    reason: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

withCleanJSON(auditLogSchema);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
AuditLog.ACTION = {
  SCHEDULE_CANCELLED: 'SCHEDULE_CANCELLED',
  SCHEDULE_RESCHEDULED: 'SCHEDULE_RESCHEDULED',
  BOOKING_CANCELLED_SHOWTIME_CANCELLED: 'BOOKING_CANCELLED_SHOWTIME_CANCELLED',
  BOOKING_REFUND_REQUESTED: 'BOOKING_REFUND_REQUESTED',
  BOOKING_RESCHEDULE_NOTIFIED: 'BOOKING_RESCHEDULE_NOTIFIED',
  BOOKING_RESCHEDULE_ACCEPTED: 'BOOKING_RESCHEDULE_ACCEPTED',
  BOOKING_RESCHEDULE_REFUND_REQUESTED: 'BOOKING_RESCHEDULE_REFUND_REQUESTED',
  BOOKING_SHOWTIME_CHANGED: 'BOOKING_SHOWTIME_CHANGED',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  REFUND_APPROVED: 'REFUND_APPROVED',
  REFUND_REJECTED: 'REFUND_REJECTED',
  REFUND_PROCESSING: 'REFUND_PROCESSING',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  REFUND_FAILED: 'REFUND_FAILED',
};

module.exports = AuditLog;
