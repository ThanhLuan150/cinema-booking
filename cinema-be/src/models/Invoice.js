const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const invoiceSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    ticket_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true },
    code: { type: String, required: true },
    total_price: { type: Number, required: true },
    combo_ids: { type: [Number], default: [] },
    voucher_code: { type: String, default: null },
    discount_amount: { type: Number, default: 0 },
    status: { type: Number, default: 1 }, // 1 = paid, 0 = cancelled, 2 = refunded
    checked_in: { type: Boolean, default: false },
  },
  { timestamps: true },
);

withCleanJSON(invoiceSchema);

module.exports = mongoose.model('Invoice', invoiceSchema);
