const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const refundSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    booking_id: { type: Number, required: true, index: true },
    payment_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true }, // the booking's owner (customer)
    branch_id: { type: Number, default: null, index: true }, // denormalized from Booking.branch_id, for BRANCH-scope filtering
    shift_id: { type: Number, default: null, index: true },
    amount: { type: Number, required: true }, // backend-computed from the cancellation policy — never trust a client-supplied amount
    policy_percent: { type: Number, required: true }, // 0-100, the refund policy tier applied at request time
    reason: { type: String, default: null }, // customer's stated reason (informational only)
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'REQUESTED',
      index: true,
    },
    requested_by: { type: Number, default: null },
    requested_at: { type: Date, default: Date.now },
    decided_by: { type: Number, default: null }, // who approved/rejected
    decided_at: { type: Date, default: null },
    decision_reason: { type: String, default: null }, // required for REJECTED
    processed_by: { type: Number, default: null }, // who started moving the money
    processed_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    failed_at: { type: Date, default: null },
    failure_reason: { type: String, default: null },
  },
  { timestamps: true },
);

withCleanJSON(refundSchema);

const Refund = mongoose.model('Refund', refundSchema);
Refund.STATUS = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};
// Statuses a booking can still have an outstanding refund attempt in — used to block a
// duplicate refund request for the same booking.
Refund.ACTIVE_STATUSES = [Refund.STATUS.REQUESTED, Refund.STATUS.APPROVED, Refund.STATUS.PROCESSING];

module.exports = Refund;
