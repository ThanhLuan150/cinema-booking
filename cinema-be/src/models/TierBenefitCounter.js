const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const tierBenefitCounterSchema = new mongoose.Schema(
  {
    account_id: { type: Number, required: true },
    period: { type: String, required: true }, // 'YYYY-MM' in the business timezone
    used: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

tierBenefitCounterSchema.index({ account_id: 1, period: 1 }, { unique: true });

withCleanJSON(tierBenefitCounterSchema);

module.exports = mongoose.model('TierBenefitCounter', tierBenefitCounterSchema);
