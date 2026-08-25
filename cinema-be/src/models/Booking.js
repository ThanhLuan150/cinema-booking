const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const bookingSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true }, // order id, shared with the sibling Invoice rows' `code`
    account_id: { type: Number, required: true, index: true },
    schedule_id: { type: Number, required: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    ticket_ids: { type: [Number], default: [] },
    combo_ids: { type: [Number], default: [] },
    voucher_code: { type: String, default: null },
    discount_amount: { type: Number, default: 0 },
    seat_total: { type: Number, default: 0 },
    combo_total: { type: Number, default: 0 },
    total_price: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'COMPLETED'],
      default: 'PENDING',
      index: true,
    },
    expires_at: { type: Date, default: null }, // only meaningful while status === PENDING
    paid_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    cancel_reason: { type: String, default: null },
    created_by: { type: Number, default: null }, // employee/branch admin who created it via counter-sale
    needs_reschedule_response: { type: Boolean, default: false },
  },
  { timestamps: true },
);

withCleanJSON(bookingSchema);

const Booking = mongoose.model('Booking', bookingSchema);
Booking.STATUS = { PENDING: 'PENDING', PAID: 'PAID', CANCELLED: 'CANCELLED', EXPIRED: 'EXPIRED', COMPLETED: 'COMPLETED' };

module.exports = Booking;
