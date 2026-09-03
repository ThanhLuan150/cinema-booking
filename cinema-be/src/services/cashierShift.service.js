const cashierShiftRepository = require('../repositories/cashierShift.repository');
const CashierShift = require('../models/CashierShift');

// Money here is VND (integers in practice), but every figure still goes through this so a
// float that picked up drift on the way in can never leak into a reconciliation report.
function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Expected Cash = Opening Cash + Cash Sales - Cash Refund.
// Deliberately pure and free of any request/DB coupling: this is the formula the ticket
// specifies, and it is only ever fed server-derived numbers — the client never gets a say.
function calculateExpectedCash({ openingCash, cashSales, cashRefunds }) {
  return round(Number(openingCash || 0) + Number(cashSales || 0) - Number(cashRefunds || 0));
}

// Difference = Actual Cash - Expected Cash. Positive = drawer over, negative = drawer short.
function calculateDifference({ actualCash, expectedCash }) {
  return round(Number(actualCash || 0) - Number(expectedCash || 0));
}

// Adds up everything the shift collected and paid out, then applies the formula above.
// For an OPEN shift this is a live running total; the numbers are frozen onto the row at
// close time so a CLOSED shift always reports exactly what it was reconciled against, even
// if a later refund is stamped elsewhere.
async function computeReconciliation(shift) {
  if (shift.status === CashierShift.STATUS.CLOSED) {
    return {
      openingCash: shift.opening_cash,
      cashSales: shift.cash_sales ?? 0,
      cashRefunds: shift.cash_refunds ?? 0,
      expectedCash: shift.expected_cash ?? 0,
      actualCash: shift.actual_cash,
      difference: shift.difference,
      live: false,
    };
  }

  const [sales, refunds] = await Promise.all([
    cashierShiftRepository.sumCashSales(shift.id),
    cashierShiftRepository.sumCashRefunds(shift.id),
  ]);

  return {
    openingCash: shift.opening_cash,
    cashSales: round(sales.total),
    ticketCash: round(sales.ticketCash),
    comboCash: round(sales.comboCash),
    cashRefunds: round(refunds.total),
    expectedCash: calculateExpectedCash({
      openingCash: shift.opening_cash,
      cashSales: sales.total,
      cashRefunds: refunds.total,
    }),
    actualCash: null,
    difference: null,
    live: true,
  };
}

// The drawer a cashier's next transaction belongs to, or null when they have none open.
// Callers treat null as "sell anyway, just don't attribute it" — a bookkeeping lookup must
// never be the thing that fails a sale the customer is standing at the counter for.
async function getOpenShiftForAccount(accountId) {
  if (!accountId) return null;
  try {
    return await cashierShiftRepository.findOpenByAccount(accountId);
  } catch (err) {
    console.error('[cashierShift] failed to resolve open shift for account', accountId, err.message);
    return null;
  }
}

async function isTransactionLocked(shiftId) {
  if (shiftId === null || shiftId === undefined) return false;
  const shift = await cashierShiftRepository.findById(shiftId);
  return Boolean(shift && shift.status === CashierShift.STATUS.CLOSED);
}

module.exports = {
  round,
  calculateExpectedCash,
  calculateDifference,
  computeReconciliation,
  getOpenShiftForAccount,
  isTransactionLocked,
};
