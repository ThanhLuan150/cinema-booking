const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

// Singleton document (id always 1) holding the admin-configurable knobs for the whole loyalty
// program, so the earn rate / expiry window / redemption value never have to be hardcoded in
// the services that use them.
const loyaltyConfigSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, default: 1 },
    // A customer earns 1 point per this many currency units of a booking's total_price.
    amount_per_point: { type: Number, required: true, min: 1, default: 10000 },
    // Days after which an EARN transaction's un-redeemed points expire. null = never expire.
    points_expiry_days: { type: Number, default: 365, min: 1 },
    // Currency value of 1 point when redeemed.
    redeem_value_per_point: { type: Number, required: true, min: 0, default: 100 },
    // Minimum points a customer must redeem at once.
    min_redeem_points: { type: Number, required: true, min: 0, default: 100 },
    updated_by: { type: Number, default: null },
  },
  { timestamps: true },
);

withCleanJSON(loyaltyConfigSchema);

const LoyaltyConfig = mongoose.model('LoyaltyConfig', loyaltyConfigSchema);
LoyaltyConfig.SINGLETON_ID = 1;

module.exports = LoyaltyConfig;
