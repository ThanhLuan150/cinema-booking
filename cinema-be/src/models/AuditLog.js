const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');


const ENTITY_TYPE = {
  BRANCH: 'BRANCH',
  EMPLOYEE: 'EMPLOYEE',
  MOVIE: 'MOVIE',
  SCHEDULE: 'SCHEDULE',
  BOOKING: 'BOOKING',
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
  TICKET: 'TICKET',
  SYSTEM_CONFIG: 'SYSTEM_CONFIG',
  CASHIER_SHIFT: 'CASHIER_SHIFT',
};

const ACTION = {
  // Branch
  CREATE_BRANCH: 'CREATE_BRANCH',
  UPDATE_BRANCH: 'UPDATE_BRANCH',
  // Employee
  CREATE_EMPLOYEE: 'CREATE_EMPLOYEE',
  UPDATE_EMPLOYEE: 'UPDATE_EMPLOYEE',
  CHANGE_EMPLOYEE_POSITION: 'CHANGE_EMPLOYEE_POSITION',
  // Movie
  CREATE_MOVIE: 'CREATE_MOVIE',
  UPDATE_MOVIE: 'UPDATE_MOVIE',
  DELETE_MOVIE: 'DELETE_MOVIE',
  // Showtime
  CREATE_SHOWTIME: 'CREATE_SHOWTIME',
  UPDATE_SHOWTIME: 'UPDATE_SHOWTIME',
  CANCEL_SHOWTIME: 'CANCEL_SHOWTIME',
  // Booking
  CREATE_BOOKING: 'CREATE_BOOKING',
  CANCEL_BOOKING: 'CANCEL_BOOKING',
  // Payment
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  REFUND: 'REFUND',
  // Ticket
  TICKET_ISSUED: 'TICKET_ISSUED',
  TICKET_CHECKIN: 'TICKET_CHECKIN',
  TICKET_CANCELLED: 'TICKET_CANCELLED',

  // Pre-existing (Ticket 15) — kept so the schedule/booking/refund trail written before this
  // ticket stays queryable through the same model.
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
  UPDATE_SYSTEM_CONFIG: 'UPDATE_SYSTEM_CONFIG',
  RESET_SYSTEM_CONFIG: 'RESET_SYSTEM_CONFIG',

  // Cashier shift & cash reconciliation (Ticket 30)
  SHIFT_OPENED: 'SHIFT_OPENED',
  SHIFT_CLOSED: 'SHIFT_CLOSED',
};

const auditLogSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    entity_type: { type: String, enum: Object.values(ENTITY_TYPE), required: true, index: true },
    entity_id: { type: Number, required: true, index: true },
    action: { type: String, enum: Object.values(ACTION), required: true, index: true },
    // The actor's account id. Null only for a system/sweep-driven change (e.g. a cron job) or a
    // gateway callback that carries no user session.
    performed_by: { type: Number, default: null, index: true },
    // Branch the action belongs to, when it has one. Null = system-wide entity (e.g. the Movie
    // catalogue). BRANCH_ADMIN queries are always constrained to their own branch_id.
    branch_id: { type: Number, default: null, index: true },
    reason: { type: String, default: null },
    // Small, non-sensitive context only — never passwords, tokens, card data, full PII, etc.
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// --- Immutability -----------------------------------------------------------
// "Không cho sửa/xóa Audit Log tùy tiện": the model refuses every in-place update and every
// delete. Writes only ever happen through AuditLog.create(...) (a fresh doc). The raw driver
// (e.g. test teardown's collection.deleteMany) still bypasses Mongoose middleware — that is
// intentional and out of the app's own code paths.
const IMMUTABLE_MESSAGE = 'AuditLog records are append-only and cannot be modified or deleted';

auditLogSchema.pre('save', function preventUpdate(next) {
  if (!this.isNew) return next(new Error(IMMUTABLE_MESSAGE));
  next();
});

for (const op of [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  auditLogSchema.pre(op, function blockMutation(next) {
    next(new Error(IMMUTABLE_MESSAGE));
  });
}

withCleanJSON(auditLogSchema);

// The ticket's Log spec names the actor column `user_id`; the stored field is `performed_by`
// (inherited from Ticket 15). Expose `user_id` as an alias on every serialized row so the API
// payload matches the spec without a data migration.
const baseTransform = auditLogSchema.options.toJSON.transform;
auditLogSchema.options.toJSON.transform = (doc, ret, options) => {
  const out = baseTransform ? baseTransform(doc, ret, options) : ret;
  out.user_id = out.performed_by ?? null;
  return out;
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
AuditLog.ENTITY_TYPE = ENTITY_TYPE;
AuditLog.ACTION = ACTION;
AuditLog.IMMUTABLE_MESSAGE = IMMUTABLE_MESSAGE;

module.exports = AuditLog;
