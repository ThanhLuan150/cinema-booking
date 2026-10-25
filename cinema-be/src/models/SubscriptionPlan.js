const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');
const { benefitsSchema } = require('./membershipBenefits');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // MoMo refuses charges under 1,000 VND, so a plan can never be cheaper than that.
    price: { type: Number, required: true, min: 1000 },
    duration_days: { type: Number, required: true, min: 1, max: 366 },
    benefits: { type: benefitsSchema, default: () => ({}) },
    active: { type: Boolean, default: true, index: true },
    sort_order: { type: Number, default: 0 },
    created_by: { type: Number, default: null },
    updated_by: { type: Number, default: null },
  },
  { timestamps: true },
);

withCleanJSON(subscriptionPlanSchema);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
