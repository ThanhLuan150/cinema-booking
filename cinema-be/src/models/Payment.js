const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const paymentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, index: true }, // = Booking.code (order id)
    booking_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true },
    branch_id: { type: Number, default: null, index: true },
    shift_id: { type: Number, default: null, index: true },
    type: { type: String, enum: ['ONLINE', 'COUNTER'], required: true },
    method: { type: String, enum: ['MOMO', 'CASH', 'CARD', 'QR_PAYMENT'], required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUND_PENDING', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    idempotency_key: { type: String, unique: true, sparse: true },
    gateway_transaction_id: { type: String, unique: true, sparse: true },
    pay_url: { type: String, default: null },
    raw_gateway_response: { type: mongoose.Schema.Types.Mixed, default: null },
    failure_reason: { type: String, default: null },
    paid_at: { type: Date, default: null },
    failed_at: { type: Date, default: null },
    refund_reason: { type: String, default: null },
    refund_requested_at: { type: Date, default: null },
    refunded_at: { type: Date, default: null },
    refunded_by: { type: Number, default: null },
    created_by: { type: Number, default: null },
  },
  { timestamps: true },
);

withCleanJSON(paymentSchema);

const Payment = mongoose.model('Payment', paymentSchema);
Payment.STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
};
Payment.TYPE = { ONLINE: 'ONLINE', COUNTER: 'COUNTER' };
// CARD/QR_PAYMENT are counter-only methods (Ticket 29: Box Office / POS) — MOMO stays the
// online gateway, CASH/CARD/QR_PAYMENT are what a cashier can take at the counter.
Payment.METHOD = { MOMO: 'MOMO', CASH: 'CASH', CARD: 'CARD', QR_PAYMENT: 'QR_PAYMENT' };

module.exports = Payment;
