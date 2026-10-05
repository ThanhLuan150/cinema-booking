const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const STATUS = {
  WAITING: 'WAITING',
  NOTIFIED: 'NOTIFIED',
  BOOKED: 'BOOKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};
const ACTIVE_STATUSES = [STATUS.WAITING, STATUS.NOTIFIED];

const CLOSE_REASON = {
  CUSTOMER_CANCELLED: 'CUSTOMER_CANCELLED',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  SHOWTIME_STARTED: 'SHOWTIME_STARTED',
  SHOWTIME_CANCELLED: 'SHOWTIME_CANCELLED',
};

const waitlistSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    account_id: { type: Number, required: true },
    schedule_id: { type: Number, required: true },
    // Denormalized from the Schedule for the customer's list view.
    branch_id: { type: Number, default: null },
    movie_id: { type: Number, default: null },
    seat_count: { type: Number, required: true, min: 1 },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.WAITING },

    // The offer. Set together on WAITING -> NOTIFIED; the tickets are HELD by `account_id` until `expires_at`.
    notified_at: { type: Date, default: null },
    expires_at: { type: Date, default: null },
    offered_ticket_ids: { type: [Number], default: [] },
    offered_seat_codes: { type: [String], default: [] },

    booking_id: { type: Number, default: null },
    booked_at: { type: Date, default: null },
    expired_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    close_reason: { type: String, enum: [...Object.values(CLOSE_REASON), null], default: null },
  },
  { timestamps: true },
);

waitlistSchema.index(
  { schedule_id: 1, account_id: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ACTIVE_STATUSES } },
    name: 'one_active_entry_per_customer_showtime',
  },
);
// The queue: the head is the lowest `id` still WAITING on a showtime.
waitlistSchema.index({ schedule_id: 1, status: 1, id: 1 });
waitlistSchema.index({ account_id: 1, id: -1 });

withCleanJSON(waitlistSchema);

const Waitlist = mongoose.model('Waitlist', waitlistSchema);
Waitlist.STATUS = STATUS;
Waitlist.ACTIVE_STATUSES = ACTIVE_STATUSES;
Waitlist.CLOSE_REASON = CLOSE_REASON;

module.exports = Waitlist;
