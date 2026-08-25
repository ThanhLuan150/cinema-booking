const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const invoiceSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    booking_id: { type: Number, default: null, index: true },
    ticket_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true },
    code: { type: String, required: true },
    total_price: { type: Number, required: true },
    combo_ids: { type: [Number], default: [] },
    voucher_code: { type: String, default: null },
    discount_amount: { type: Number, default: 0 },
    status: { type: Number, default: 1 }, // 1 = paid, 0 = cancelled, 2 = refunded
    checked_in: { type: Boolean, default: false },
    created_by: { type: Number, default: null }, // account_id of the employee/branch admin who sold this at the counter (null = self-service online purchase)
    qr_token: { type: String, unique: true, sparse: true, index: true },
    ticket_status: {
      type: String,
      enum: ['ISSUED', 'USED', 'CANCELLED', 'REFUNDED', 'EXPIRED'],
      default: 'ISSUED',
      index: true,
    },
    issued_at: { type: Date, default: null },
    checked_in_at: { type: Date, default: null },
    checked_in_by: { type: Number, default: null }, // account_id of the ticket.checkin staff who scanned it
    checkin_branch_id: { type: Number, default: null }, // branch the check-in was performed at
  },
  { timestamps: true },
);

withCleanJSON(invoiceSchema);

const Invoice = mongoose.model('Invoice', invoiceSchema);
Invoice.TICKET_STATUS = {
  ISSUED: 'ISSUED',
  USED: 'USED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  EXPIRED: 'EXPIRED',
};

module.exports = Invoice;
