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
    paid_at: { type: Date, default: null },
    prepared_at: { type: Date, default: null },
    ready_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
    cancel_reason: { type: String, default: null },
    created_by: { type: Number, default: null }, // Combo Staff/Cashier account who took the order
  },
  { timestamps: true },
);

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

module.exports = ComboOrder;
