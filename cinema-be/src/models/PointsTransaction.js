const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// The full loyalty points ledger — every balance change is one row here, never a bare
// increment on Account, so "Lịch sử Points" (points history) and expiry accounting always
// have a complete trail to read from.
const TYPE = {
  EARN: 'EARN', // booking paid -> points credited
  REDEEM: 'REDEEM', // customer spent points
  EXPIRE: 'EXPIRE', // un-redeemed points aged past their expiry window
  REVERSAL: 'REVERSAL', // a booking's EARN was undone because the booking was refunded
  ADJUST: 'ADJUST', // manual admin correction/bonus
};

const pointsTransactionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    account_id: { type: Number, required: true, index: true },
    type: { type: String, enum: Object.values(TYPE), required: true },
    // Signed: positive for EARN and a positive ADJUST, negative for REDEEM/EXPIRE/REVERSAL
    // and a negative ADJUST.
    points: { type: Number, required: true },
    // FIFO bookkeeping: only meaningful when points > 0 (EARN / positive ADJUST). Starts equal
    // to `points` and is drawn down as redeemPoints/expirePoints/reversePointsForBooking
    // consume from it, so multiple partial spends of the same grant never double-count.
    remaining_points: { type: Number, default: 0, min: 0 },
    balance_after: { type: Number, default: null },
    booking_id: { type: Number, default: null, index: true },
    payment_id: { type: Number, default: null },
    expires_at: { type: Date, default: null },
    description: { type: String, default: '' },
    created_by: { type: Number, default: null }, // admin accountId for ADJUST, null for system-generated
  },
  { timestamps: true },
);

// Guards against ever recording two EARN (or two REVERSAL) rows for the same booking — the
// backstop for "no double points from a duplicate payment callback" beyond the idempotency
// already built into markPaidIfPending/finalizeMomoOrder. Two separate partial indexes because
// MongoDB partial-index filters don't support $in.
pointsTransactionSchema.index(
  { booking_id: 1 },
  { unique: true, partialFilterExpression: { type: 'EARN' }, name: 'booking_earn_unique' },
);
pointsTransactionSchema.index(
  { booking_id: 1 },
  { unique: true, partialFilterExpression: { type: 'REVERSAL' }, name: 'booking_reversal_unique' },
);

withCleanJSON(pointsTransactionSchema);

const PointsTransaction = mongoose.model('PointsTransaction', pointsTransactionSchema);
PointsTransaction.TYPE = TYPE;

module.exports = PointsTransaction;
