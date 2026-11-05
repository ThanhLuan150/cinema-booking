const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const STATUS = { RESERVED: 'RESERVED', CONSUMED: 'CONSUMED', RELEASED: 'RELEASED' };
const SOURCE = { SUBSCRIPTION: 'SUBSCRIPTION', TIER: 'TIER' };

const membershipBenefitUsageSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    account_id: { type: Number, required: true, index: true },
    booking_code: { type: String, required: true, index: true },
    booking_id: { type: Number, default: null, index: true },
    ticket_id: { type: Number, required: true },
    source: { type: String, enum: Object.values(SOURCE), required: true },
    subscription_id: { type: Number, default: null, index: true }, // SUBSCRIPTION
    period: { type: String, default: null }, // TIER: 'YYYY-MM'
    amount: { type: Number, required: true, min: 0 }, // the part of the seat price it covered
    status: { type: String, enum: Object.values(STATUS), default: STATUS.RESERVED, index: true },
    consumed_at: { type: Date, default: null },
    released_at: { type: Date, default: null },
    release_reason: { type: String, default: null },
  },
  { timestamps: true },
);

// A seat is covered at most once per booking.
membershipBenefitUsageSchema.index({ booking_code: 1, ticket_id: 1 }, { unique: true });

withCleanJSON(membershipBenefitUsageSchema);

const MembershipBenefitUsage = mongoose.model('MembershipBenefitUsage', membershipBenefitUsageSchema);
MembershipBenefitUsage.STATUS = STATUS;
MembershipBenefitUsage.SOURCE = SOURCE;

module.exports = MembershipBenefitUsage;
