const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const seatSwapSchema = new mongoose.Schema(
  {
    from_ticket_id: { type: Number, required: true },
    from_seat_code: { type: String, required: true },
    from_seat_type: { type: Number, default: 0 },
    to_ticket_id: { type: Number, required: true },
    to_seat_code: { type: String, required: true },
    to_seat_type: { type: Number, default: 0 },
    old_price: { type: Number, required: true }, // backend-priced, same pricing context for both seats
    new_price: { type: Number, required: true },
    price_difference: { type: Number, required: true }, // new_price - old_price
    settlement: { type: String, enum: ['NONE', 'NOT_REFUNDED'], required: true },
    swapped_by: { type: Number, default: null },
    swapped_at: { type: Date, required: true },
  },
  { _id: false },
);

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
    promotion_code: { type: String, default: null },
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
    seat_swaps: { type: [seatSwapSchema], default: [] },
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
Invoice.SEAT_SWAP_SETTLEMENT = { NONE: 'NONE', NOT_REFUNDED: 'NOT_REFUNDED' };

module.exports = Invoice;
