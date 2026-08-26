const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const promotionUsageSchema = new mongoose.Schema(
  {
    promotion_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

promotionUsageSchema.index({ promotion_id: 1, account_id: 1 }, { unique: true });

withCleanJSON(promotionUsageSchema);

module.exports = mongoose.model('PromotionUsage', promotionUsageSchema);
