const CashierShift = require('../models/CashierShift');
const Payment = require('../models/Payment');
const ComboOrder = require('../models/ComboOrder');
const Refund = require('../models/Refund');
const nextId = require('../utils/nextId');

class ShiftAlreadyOpenError extends Error {
  constructor(message = 'This cashier already has an open shift') {
    super(message);
    this.name = 'ShiftAlreadyOpenError';
  }
}

async function open({ employeeId, accountId, branchId, openingCash, openedBy, note = null }) {
  const existing = await findOpenByEmployee(employeeId);
  if (existing) throw new ShiftAlreadyOpenError();

  try {
    return await CashierShift.create({
      id: await nextId('cashierShift'),
      employee_id: Number(employeeId),
      account_id: Number(accountId),
      branch_id: Number(branchId),
      opened_at: new Date(),
      opening_cash: openingCash,
      status: CashierShift.STATUS.OPEN,
      opened_by: openedBy ?? null,
      open_note: note,
    });
  } catch (err) {
    if (err.code === 11000) throw new ShiftAlreadyOpenError();
    throw err;
  }
}

async function findById(id) {
  return CashierShift.findOne({ id: Number(id) });
}

async function findOpenByEmployee(employeeId) {
  return CashierShift.findOne({ employee_id: Number(employeeId), status: CashierShift.STATUS.OPEN });
}

async function findOpenByAccount(accountId) {
  return CashierShift.findOne({ account_id: Number(accountId), status: CashierShift.STATUS.OPEN });
}

async function findBranchIdByShiftId(id) {
  const shift = await CashierShift.findOne({ id: Number(id) }, { branch_id: 1 });
  return shift ? shift.branch_id : null;
}

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    CashierShift.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    CashierShift.countDocuments(filter),
  ]);
  return { data, total };
}

// OPEN -> CLOSED, guarded on the current status so a double-close (or a close racing another
// close) updates nothing and returns null instead of overwriting a settled reconciliation.
async function close(id, { cashSales, cashRefunds, expectedCash, actualCash, difference, closedBy, note = null }) {
  return CashierShift.findOneAndUpdate(
    { id: Number(id), status: CashierShift.STATUS.OPEN },
    {
      $set: {
        status: CashierShift.STATUS.CLOSED,
        closed_at: new Date(),
        cash_sales: cashSales,
        cash_refunds: cashRefunds,
        expected_cash: expectedCash,
        actual_cash: actualCash,
        difference,
        closed_by: closedBy ?? null,
        close_note: note,
      },
    },
    { new: true },
  );
}

async function sumField(Model, filter, field) {
  const [row] = await Model.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: `$${field}` } } }]);
  return row ? row.total : 0;
}

// Cash that went INTO the drawer during the shift.
//
// Payments are matched on `paid_at` rather than `status: PAID` on purpose: a later refund
// flips the Payment to REFUNDED, and if that dropped the sale out of this sum the refund
// would be subtracted twice (once by vanishing, once by cash_refunds below).
//
// Combo orders are the standalone counter sales only — the ones bought with tickets are
// already inside their booking's Payment.amount and are never stamped with a shift_id.
// A cancelled order is excluded: cancelling a paid order inside an open shift means the
// money went back over the counter.
async function sumCashSales(shiftId) {
  const [ticketCash, comboCash] = await Promise.all([
    sumField(Payment, { shift_id: Number(shiftId), method: Payment.METHOD.CASH, paid_at: { $ne: null } }, 'amount'),
    sumField(
      ComboOrder,
      {
        shift_id: Number(shiftId),
        payment_method: 'CASH',
        paid_at: { $ne: null },
        status: { $ne: ComboOrder.STATUS.CANCELLED },
      },
      'total_price',
    ),
  ]);
  return { ticketCash, comboCash, total: ticketCash + comboCash };
}

// Cash that went OUT of the drawer during the shift. Only refunds whose original payment was
// CASH ever get stamped with a shift_id, so everything matched here is a real drawer payout.
async function sumCashRefunds(shiftId) {
  const total = await sumField(
    Refund,
    { shift_id: Number(shiftId), status: Refund.STATUS.COMPLETED },
    'amount',
  );
  return { total };
}

module.exports = {
  ShiftAlreadyOpenError,
  open,
  findById,
  findOpenByEmployee,
  findOpenByAccount,
  findBranchIdByShiftId,
  findFiltered,
  close,
  sumCashSales,
  sumCashRefunds,
};
