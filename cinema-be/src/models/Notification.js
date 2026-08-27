const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// Ticket 25 — the durable record of a notification raised for one of the important booking/
// payment/showtime events. The row itself is the in-app notification (the customer reads it
// through GET /api/notifications); `channels` may additionally ask for an EMAIL copy, which is
// the fallible side that the retry sweep re-attempts.
//
// Design rules from the ticket:
//   - No duplicate notification  -> `dedupe_key` carries a unique (sparse) index; the repository
//     turns the duplicate-key error into a no-op.
//   - Retry on failure           -> `status`, `attempts`, `next_attempt_at`; jobs/notificationRetry
//     re-runs delivery with exponential backoff up to `max_attempts`.
//   - Must not fail the main txn  -> nothing here is created inside the business transaction; the
//     service that writes it never throws.
//   - No sensitive data          -> `data` only ever holds movie / branch / room / showtime /
//     seat / booking code / ticket code — never emails, tokens, card or account PII.
//   - History                    -> every notification is kept; `read_at` marks it seen.

const EVENT = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  TICKET_ISSUED: 'TICKET_ISSUED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  SHOWTIME_CANCELLED: 'SHOWTIME_CANCELLED',
  SHOWTIME_CHANGED: 'SHOWTIME_CHANGED',
};

const STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
};

const CHANNEL = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
};

const DEFAULT_MAX_ATTEMPTS = 5;

const notificationSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    // Recipient account. Notifications are always personal — the API only ever serves a caller
    // their own rows.
    account_id: { type: Number, required: true, index: true },
    type: { type: String, enum: Object.values(EVENT), required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    // Safe, display-only context: { movie, branch, room, showtime, seats, bookingCode, ticketCodes, ... }
    data: { type: mongoose.Schema.Types.Mixed, default: null },

    channels: {
      type: [String],
      enum: Object.values(CHANNEL),
      default: [CHANNEL.IN_APP],
    },

    status: { type: String, enum: Object.values(STATUS), default: STATUS.PENDING, index: true },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: DEFAULT_MAX_ATTEMPTS },
    last_error: { type: String, default: null },
    // When set and in the past, the retry sweep will pick this row up again. Null once the row
    // reaches a terminal state (SENT, or FAILED with attempts exhausted).
    next_attempt_at: { type: Date, default: null, index: true },
    sent_at: { type: Date, default: null },

    read_at: { type: Date, default: null },

    // Deterministic key that identifies "this event, for this recipient, about this booking".
    // The unique sparse index is what actually guarantees no duplicate notification is stored.
    // No `default` on purpose: an unset key must be *absent* (not null) so the sparse index
    // skips it — otherwise every keyless row would collide on `null`.
    dedupe_key: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

notificationSchema.index({ account_id: 1, id: -1 });

withCleanJSON(notificationSchema);
// Keep the API payload lean and free of delivery-machinery/internal fields.
notificationSchema.set('toJSON', {
  virtuals: false,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.dedupe_key;
    delete ret.max_attempts;
    delete ret.last_error;
    delete ret.next_attempt_at;
    delete ret.attempts;
    return ret;
  },
});

const Notification = mongoose.model('Notification', notificationSchema);
Notification.EVENT = EVENT;
Notification.STATUS = STATUS;
Notification.CHANNEL = CHANNEL;
Notification.DEFAULT_MAX_ATTEMPTS = DEFAULT_MAX_ATTEMPTS;

module.exports = Notification;
