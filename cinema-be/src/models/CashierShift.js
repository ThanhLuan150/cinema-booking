const mongoose = require('mongoose');
const { withCleanJSON } = require('./plugins');

const STATUS = { OPEN: 'OPEN', CLOSED: 'CLOSED' };

const cashierShiftSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    employee_id: { type: Number, required: true, index: true },
    // Employee.user_id. Denormalized because the money trail keys off the *account*:
    // Payment.created_by, ComboOrder.created_by and Refund.processed_by all store account ids.
    account_id: { type: Number, required: true, index: true },
    branch_id: { type: Number, required: true, index: true },
    opened_at: { type: Date, default: Date.now },
    closed_at: { type: Date, default: null },
    // Counted float the drawer starts with. The only cash figure the client ever supplies
    // besides actual_cash.
    opening_cash: { type: Number, required: true, min: 0 },
    // Everything below is written by the backend at close time and never accepted from a
    // request body: expected_cash = opening_cash + cash_sales - cash_refunds, and
    // difference = actual_cash - expected_cash.
    cash_sales: { type: Number, default: null },
    cash_refunds: { type: Number, default: null },
    expected_cash: { type: Number, default: null },
    actual_cash: { type: Number, default: null },
    difference: { type: Number, default: null },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.OPEN, index: true },
    opened_by: { type: Number, default: null },
    closed_by: { type: Number, default: null },
    open_note: { type: String, default: null },
    close_note: { type: String, default: null },
  },
  { timestamps: true },
);

cashierShiftSchema.index(
  { employee_id: 1 },
  { unique: true, partialFilterExpression: { status: STATUS.OPEN }, name: 'one_open_shift_per_employee' },
);

withCleanJSON(cashierShiftSchema);

const CashierShift = mongoose.model('CashierShift', cashierShiftSchema);
CashierShift.STATUS = STATUS;

module.exports = CashierShift;
