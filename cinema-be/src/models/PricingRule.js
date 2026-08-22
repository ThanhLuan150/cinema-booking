const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');
const Room = require('./Room');

// A rule "wins" for a given ticket when every field it specifies (non-null) matches the
const DAY_TYPES = ['WEEKDAY', 'WEEKEND', 'HOLIDAY'];
// Loyalty tier of the booking account. NONE also stands in for "Loại Customer: khách vãng lai"
// (non-member) — see Account.membership_level.
const MEMBERSHIP_LEVELS = ['NONE', 'SILVER', 'GOLD', 'PLATINUM'];
const SEAT_TYPES = [0, 1, 2]; // 0 = standard, 1 = vip, 2 = couple (matches Seat.seat_type)

const pricingRuleSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // the final ticket price when this rule wins
    priority: { type: Number, default: 0, index: true }, // higher number = takes precedence on conflict
    active: { type: Boolean, default: true, index: true },
    effective_from: { type: String, default: null },
    effective_to: { type: String, default: null },
    branch_id: { type: Number, default: null, index: true },
    room_type: { type: String, enum: [...Room.TYPES, null], default: null },
    seat_type: { type: Number, enum: [...SEAT_TYPES, null], default: null },
    category_id: { type: Number, default: null }, 
    day_type: { type: String, enum: [...DAY_TYPES, null], default: null },
    time_start: { type: String, default: null },
    time_end: { type: String, default: null },
    membership_level: { type: String, enum: [...MEMBERSHIP_LEVELS, null], default: null },
  },
  { timestamps: true },
);

pricingRuleSchema.index({ branch_id: 1, active: 1 });

withCleanJSON(pricingRuleSchema);

const PricingRule = mongoose.model('PricingRule', pricingRuleSchema);
PricingRule.DAY_TYPES = DAY_TYPES;
PricingRule.MEMBERSHIP_LEVELS = MEMBERSHIP_LEVELS;
PricingRule.SEAT_TYPES = SEAT_TYPES;

module.exports = PricingRule;
