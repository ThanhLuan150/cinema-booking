const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const voucherSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    cinema_id: { type: Number, default: null, index: true }, // null = system-wide (admin-owned)
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discount_type: { type: String, enum: ['percent', 'fixed'], required: true },
    discount_value: { type: Number, required: true },
    max_uses: { type: Number, default: null }, // null = unlimited
    used_count: { type: Number, default: 0 },
    valid_from: { type: Date, default: null },
    valid_to: { type: Date, default: null },
    min_order_value: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

withCleanJSON(voucherSchema);

module.exports = mongoose.model('Voucher', voucherSchema);
