const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const DISCOUNT_TYPE = {
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  PERCENTAGE: 'PERCENTAGE',
  FREE_TICKET: 'FREE_TICKET',
  FREE_COMBO: 'FREE_COMBO',
};

const voucherSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    cinema_id: { type: Number, default: null, index: true }, // null = system-wide (admin-owned)
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discount_type: { type: String, enum: Object.values(DISCOUNT_TYPE), required: true },
    discount_value: { type: Number, required: true },
    free_quantity: { type: Number, default: null },
    combo_id: { type: Number, default: null },
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

const Voucher = mongoose.model('Voucher', voucherSchema);
Voucher.DISCOUNT_TYPE = DISCOUNT_TYPE;

module.exports = Voucher;
