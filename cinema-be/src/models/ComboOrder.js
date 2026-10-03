const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const comboOrderSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    account_id: { type: Number, default: null, index: true }, // the customer the order is for, if known
    booking_id: { type: Number, default: null, index: true }, // optional link to a Booking (combo bought alongside tickets)
    items: {
      type: [
        {
          _id: false,
          combo_id: { type: Number, required: true },
          name: { type: String, required: true },
          unit_price: { type: Number, required: true },
          quantity: { type: Number, required: true },
          line_total: { type: Number, required: true },
        },
      ],
      required: true,
      // Mongoose auto-initializes array paths to [] even when nothing was set, so a plain
      // `required: true` never actually rejects an empty array — this validator does.
      validate: { validator: (value) => Array.isArray(value) && value.length > 0, message: 'items must have at least one entry' },
    },
    total_price: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    payment_method: { type: String, enum: ['CASH', 'MOMO', 'CARD', 'QR_PAYMENT'], default: null },
    shift_id: { type: Number, default: null, index: true },
    paid_at: { type: Date, default: null },
    prepared_at: { type: Date, default: null },
    ready_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    cancel_reason: { type: String, default: null },
    created_by: { type: Number, default: null }, // Concession Staff/Cashier account who took the order
    // How the order was placed when that matters downstream. null = the counter (/combo-orders) or a
    // combo bundled into a ticket booking (told apart by booking_id), exactly as before Ticket 49.
    // IN_SEAT = the customer ordered from their seat and paid for it separately (its own Payment row),
    // so its revenue is NOT inside the linked booking's combo_total — see separatelyPaidFilter below.
    channel: { type: String, enum: ['IN_SEAT', null], default: null },
    // In-seat orders only: the seat the order is delivered to, as validated from the seat QR and the
    // customer's ticket at the moment of ordering. invoice_id is the issued ticket (Invoice) for it.
    seat_delivery: {
      type: {
        _id: false,
        schedule_id: { type: Number, required: true },
        room_id: { type: Number, required: true },
        seat_code: { type: String, required: true },
        invoice_id: { type: Number, required: true },
      },
      default: null,
    },
    // In-seat orders only: an unpaid (PENDING) order is cancelled by the hold sweep after this.
    expires_at: { type: Date, default: null },
  },
  { timestamps: true },
);

// Kitchen Display queue: one branch's paid orders by status, oldest payment first.
comboOrderSchema.index({ branch_id: 1, status: 1, paid_at: 1 });
// The sweep that cancels in-seat orders whose payment never arrived.
comboOrderSchema.index({ channel: 1, status: 1, expires_at: 1 });

withCleanJSON(comboOrderSchema);

const ComboOrder = mongoose.model('ComboOrder', comboOrderSchema);
ComboOrder.STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  PREPARING: 'PREPARING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};
// Statuses from which an order can still be cancelled — once it's READY/DELIVERED the food has
// already been made/handed over, so cancellation is no longer meaningful.
ComboOrder.CANCELLABLE_STATUSES = [ComboOrder.STATUS.PENDING, ComboOrder.STATUS.PAID, ComboOrder.STATUS.PREPARING];
ComboOrder.CHANNEL = { IN_SEAT: 'IN_SEAT' };

// Orders whose money is NOT already counted in a Booking's combo_total: walk-up counter sales
// (no booking) and in-seat orders (linked to the booking for the seat, but paid on their own).
// Revenue and CRM spending add these on top of the bookings. A fresh object each call, so a caller
// can spread it into a query without sharing state.
ComboOrder.separatelyPaidFilter = () => ({
  $or: [{ booking_id: null }, { channel: ComboOrder.CHANNEL.IN_SEAT }],
});

module.exports = ComboOrder;
