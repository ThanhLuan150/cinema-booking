const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const BOOKING_TYPE = { STANDARD: 'STANDARD', GROUP: 'GROUP' };
const ORGANIZER_TYPE = { CUSTOMER: 'CUSTOMER', COMPANY: 'COMPANY' };

const groupSchema = new mongoose.Schema(
  {
    organizer_type: { type: String, enum: Object.values(ORGANIZER_TYPE), required: true },
    group_name: { type: String, default: '' },
    company_name: { type: String, default: '' },
    tax_code: { type: String, default: '' },
    contact_name: { type: String, default: '' },
    contact_phone: { type: String, default: '' },
    contact_email: { type: String, default: '' },
    note: { type: String, default: '' },
    // The discount is the best group promotion the server found, not a code the customer typed.
    auto_discount: { type: Boolean, default: false },
  },
  { _id: false },
);

// What the customer's membership took off this booking (Ticket 53), as priced at checkout. The total
// is also inside discount_amount (= every discount on the booking), so revenue reporting stays right.
const membershipSchema = new mongoose.Schema(
  {
    level: { type: String, default: 'NONE' },
    subscription_id: { type: Number, default: null },
    free_tickets: { type: Number, default: 0 },
    free_ticket_amount: { type: Number, default: 0 },
    ticket_discount_percent: { type: Number, default: 0 },
    ticket_discount_amount: { type: Number, default: 0 },
    fnb_discount_percent: { type: Number, default: 0 },
    fnb_discount_amount: { type: Number, default: 0 },
  },
  { _id: false },
);

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
    promotion_code: { type: String, default: null },
    discount_amount: { type: Number, default: 0 },
    membership_discount: { type: Number, default: 0 }, // the membership's share of discount_amount
    membership: { type: membershipSchema, default: null },
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
    booking_type: { type: String, enum: Object.values(BOOKING_TYPE), default: BOOKING_TYPE.STANDARD, index: true },
    group: { type: groupSchema, default: null },
    // Group checkout's Idempotency-Key: a retried request gets back the booking the first one made.
    // Left unset (never null) on every other booking, so the sparse unique index ignores them.
    idempotency_key: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

withCleanJSON(bookingSchema);

const Booking = mongoose.model('Booking', bookingSchema);
Booking.STATUS = { PENDING: 'PENDING', PAID: 'PAID', CANCELLED: 'CANCELLED', EXPIRED: 'EXPIRED', COMPLETED: 'COMPLETED' };
Booking.TYPE = BOOKING_TYPE;
Booking.ORGANIZER_TYPE = ORGANIZER_TYPE;

module.exports = Booking;
