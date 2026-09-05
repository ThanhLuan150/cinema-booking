const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const TYPE = { ISSUE: 'ISSUE', REDEEM: 'REDEEM', USE: 'USE', REFUND: 'REFUND', BLOCK: 'BLOCK' };

const giftCardTransactionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    gift_card_id: { type: Number, required: true, index: true },
    account_id: { type: Number, default: null, index: true },
    type: { type: String, enum: Object.values(TYPE), required: true },
    amount: { type: Number, default: 0 }, // positive for ISSUE/REDEEM/REFUND-credit, spend amount for USE
    balance_after: { type: Number, required: true },
    booking_id: { type: Number, default: null, index: true },
    reason: { type: String, default: null },
  },
  { timestamps: true },
);

// A gift card can only ever be spent once against the same booking — the idempotency guard
// behind "no duplicate request double-spends the balance".
giftCardTransactionSchema.index(
  { gift_card_id: 1, booking_id: 1, type: 1 },
  { unique: true, partialFilterExpression: { booking_id: { $type: 'number' }, type: 'USE' } },
);

withCleanJSON(giftCardTransactionSchema);

const GiftCardTransaction = mongoose.model('GiftCardTransaction', giftCardTransactionSchema);
GiftCardTransaction.TYPE = TYPE;

module.exports = GiftCardTransaction;
