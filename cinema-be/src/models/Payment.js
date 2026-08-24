const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const paymentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, index: true }, // = Booking.code (order id)
    booking_id: { type: Number, required: true, index: true },
    account_id: { type: Number, required: true, index: true },
    branch_id: { type: Number, default: null, index: true },
    type: { type: String, enum: ['ONLINE', 'COUNTER'], required: true },
    method: { type: String, enum: ['MOMO', 'CASH'], required: true },
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
Payment.METHOD = { MOMO: 'MOMO', CASH: 'CASH' };

module.exports = Payment;
