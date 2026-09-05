const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const voucherUsageSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    voucher_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true },
    booking_id: { type: Number, default: null, index: true },
    discount_amount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

withCleanJSON(voucherUsageSchema);

module.exports = mongoose.model('VoucherUsage', voucherUsageSchema);
