const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const STATUS = { ACTIVE: 'ACTIVE', USED: 'USED', EXPIRED: 'EXPIRED', BLOCKED: 'BLOCKED' };

const giftCardSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    cinema_id: { type: Number, default: null, index: true }, // null = system-wide (admin-issued)
    initial_balance: { type: Number, required: true, min: 0 },
    remaining_balance: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'VND' },
    // The customer who has claimed this card into their account. Null until redeemed — a card
    // cannot be used to pay before it has an owner.
    owner_account_id: { type: Number, default: null, index: true },
    issued_by: { type: Number, default: null }, // admin/branch-admin who issued it, null for a system batch
    redeemed_at: { type: Date, default: null },
    expires_at: { type: Date, default: null },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE, index: true },
  },
  { timestamps: true },
);

withCleanJSON(giftCardSchema);

const GiftCard = mongoose.model('GiftCard', giftCardSchema);
GiftCard.STATUS = STATUS;

module.exports = GiftCard;
