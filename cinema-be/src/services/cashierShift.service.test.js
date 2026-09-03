const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const CashierShift = require('../models/CashierShift');
const Payment = require('../models/Payment');
const ComboOrder = require('../models/ComboOrder');
const Refund = require('../models/Refund');
const cashierShiftService = require('./cashierShift.service');

beforeAll(async () => {
  await connect();
  await CashierShift.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedShift(overrides = {}) {
  return CashierShift.create({
    id: 1,
    employee_id: 5,
    account_id: 50,
    branch_id: 1,
    opening_cash: 500000,
    ...overrides,
  });
}

async function seedCashPayment(overrides = {}) {
  return Payment.create({
    id: overrides.id ?? 1,
    code: overrides.code ?? `POS-${overrides.id ?? 1}`,
    booking_id: 1,
    account_id: 10,
    branch_id: 1,
    type: 'COUNTER',
    method: 'CASH',
    amount: 100000,
    status: 'PAID',
    paid_at: new Date(),
    shift_id: 1,
    ...overrides,
  });
}

// --- Calculation ------------------------------------------------------------
// The two formulas the ticket pins down, exercised on their own before anything
// touches the database.

describe('calculateExpectedCash', () => {
  it('is opening cash plus cash sales minus cash refunds', () => {
    expect(
      cashierShiftService.calculateExpectedCash({ openingCash: 500000, cashSales: 1200000, cashRefunds: 150000 }),
    ).toBe(1550000);
  });

  it('returns the float untouched for a shift that took no money', () => {
    expect(cashierShiftService.calculateExpectedCash({ openingCash: 500000, cashSales: 0, cashRefunds: 0 })).toBe(500000);
  });

  it('can go below the opening float when refunds outweigh sales', () => {
    expect(
      cashierShiftService.calculateExpectedCash({ openingCash: 100000, cashSales: 50000, cashRefunds: 120000 }),
    ).toBe(30000);
  });

  it('treats missing sales/refunds as zero rather than NaN', () => {
    expect(cashierShiftService.calculateExpectedCash({ openingCash: 200000 })).toBe(200000);
    expect(
      cashierShiftService.calculateExpectedCash({ openingCash: 200000, cashSales: null, cashRefunds: undefined }),
    ).toBe(200000);
  });

  it('rounds away binary floating-point drift', () => {
    expect(cashierShiftService.calculateExpectedCash({ openingCash: 0.1, cashSales: 0.2, cashRefunds: 0 })).toBe(0.3);
  });
});

describe('calculateDifference', () => {
  it('is zero when the drawer counts exactly right', () => {
    expect(cashierShiftService.calculateDifference({ actualCash: 1550000, expectedCash: 1550000 })).toBe(0);
  });

  it('is positive when the drawer is over', () => {
    expect(cashierShiftService.calculateDifference({ actualCash: 1560000, expectedCash: 1550000 })).toBe(10000);
  });

  it('is negative when the drawer is short', () => {
    expect(cashierShiftService.calculateDifference({ actualCash: 1500000, expectedCash: 1550000 })).toBe(-50000);
  });
});

// --- Reconciliation over real rows -----------------------------------------

describe('computeReconciliation', () => {
  it('reports the bare float for a shift that has taken nothing', async () => {
    const result = await cashierShiftService.computeReconciliation(await seedShift());
    expect(result).toMatchObject({ openingCash: 500000, cashSales: 0, cashRefunds: 0, expectedCash: 500000, live: true });
    expect(result.actualCash).toBeNull();
    expect(result.difference).toBeNull();
  });

  it('adds ticket cash and standalone combo cash, then subtracts completed cash refunds', async () => {
    await seedShift();
    await seedCashPayment({ id: 1, amount: 300000 });
    await seedCashPayment({ id: 2, amount: 200000 });
    await ComboOrder.create({
      id: 1,
      code: 'CO-1',
      branch_id: 1,
      items: [{ combo_id: 1, name: 'Combo', unit_price: 90000, quantity: 1, line_total: 90000 }],
      total_price: 90000,
      status: 'PAID',
      payment_method: 'CASH',
      paid_at: new Date(),
      shift_id: 1,
    });
    await Refund.create({
      id: 1,
      booking_id: 1,
      payment_id: 1,
      account_id: 10,
      branch_id: 1,
      amount: 40000,
      policy_percent: 100,
      status: 'COMPLETED',
      shift_id: 1,
    });

    const result = await cashierShiftService.computeReconciliation(await CashierShift.findOne({ id: 1 }));
    expect(result.ticketCash).toBe(500000);
    expect(result.comboCash).toBe(90000);
    expect(result.cashSales).toBe(590000);
    expect(result.cashRefunds).toBe(40000);
    // 500000 float + 590000 sales - 40000 refunds
    expect(result.expectedCash).toBe(1050000);
  });

  it('ignores card/QR takings, other shifts and other cashiers', async () => {
    await seedShift();
    await seedCashPayment({ id: 1, amount: 300000 });
    await seedCashPayment({ id: 2, code: 'POS-2', amount: 900000, method: 'CARD' });
    await seedCashPayment({ id: 3, code: 'POS-3', amount: 700000, shift_id: 2 });
    await seedCashPayment({ id: 4, code: 'POS-4', amount: 400000, shift_id: null });

    const result = await cashierShiftService.computeReconciliation(await CashierShift.findOne({ id: 1 }));
    expect(result.cashSales).toBe(300000);
    expect(result.expectedCash).toBe(800000);
  });

  it('keeps a later-refunded sale in cash sales so the refund is only subtracted once', async () => {
    await seedShift();
    // The payment was taken in cash during this shift and later refunded — Payment.status is
    // now REFUNDED, but the money really was in the drawer, so it must still count as a sale.
    await seedCashPayment({ id: 1, amount: 300000, status: 'REFUNDED' });
    await Refund.create({
      id: 1,
      booking_id: 1,
      payment_id: 1,
      account_id: 10,
      branch_id: 1,
      amount: 300000,
      policy_percent: 100,
      status: 'COMPLETED',
      shift_id: 1,
    });

    const result = await cashierShiftService.computeReconciliation(await CashierShift.findOne({ id: 1 }));
    expect(result.cashSales).toBe(300000);
    expect(result.cashRefunds).toBe(300000);
    expect(result.expectedCash).toBe(500000); // net zero on top of the float
  });

  it('drops a combo order that was cancelled back over the counter', async () => {
    await seedShift();
    await ComboOrder.create({
      id: 1,
      code: 'CO-1',
      branch_id: 1,
      items: [{ combo_id: 1, name: 'Combo', unit_price: 90000, quantity: 1, line_total: 90000 }],
      total_price: 90000,
      status: 'CANCELLED',
      payment_method: 'CASH',
      paid_at: new Date(),
      cancelled_at: new Date(),
      shift_id: 1,
    });

    const result = await cashierShiftService.computeReconciliation(await CashierShift.findOne({ id: 1 }));
    expect(result.cashSales).toBe(0);
    expect(result.expectedCash).toBe(500000);
  });

  it('ignores a refund that has not actually been paid out yet', async () => {
    await seedShift();
    await seedCashPayment({ id: 1, amount: 300000 });
    await Refund.create({
      id: 1,
      booking_id: 1,
      payment_id: 1,
      account_id: 10,
      branch_id: 1,
      amount: 100000,
      policy_percent: 100,
      status: 'PROCESSING',
      shift_id: 1,
    });

    const result = await cashierShiftService.computeReconciliation(await CashierShift.findOne({ id: 1 }));
    expect(result.cashRefunds).toBe(0);
    expect(result.expectedCash).toBe(800000);
  });

  it('replays the frozen snapshot for a closed shift instead of recounting', async () => {
    await seedShift({
      status: 'CLOSED',
      closed_at: new Date(),
      cash_sales: 590000,
      cash_refunds: 40000,
      expected_cash: 1050000,
      actual_cash: 1040000,
      difference: -10000,
    });
    // A cash sale stamped with the shift *after* it settled must not move the reported figures.
    await seedCashPayment({ id: 99, code: 'POS-99', amount: 777000 });

    const result = await cashierShiftService.computeReconciliation(await CashierShift.findOne({ id: 1 }));
    expect(result).toEqual({
      openingCash: 500000,
      cashSales: 590000,
      cashRefunds: 40000,
      expectedCash: 1050000,
      actualCash: 1040000,
      difference: -10000,
      live: false,
    });
  });
});

describe('getOpenShiftForAccount', () => {
  it('finds the caller’s open drawer', async () => {
    await seedShift();
    expect((await cashierShiftService.getOpenShiftForAccount(50)).id).toBe(1);
  });

  it('returns null for an account with no open drawer, and for no account at all', async () => {
    await seedShift({ status: 'CLOSED' });
    expect(await cashierShiftService.getOpenShiftForAccount(50)).toBeNull();
    expect(await cashierShiftService.getOpenShiftForAccount(null)).toBeNull();
  });
});

describe('isTransactionLocked', () => {
  it('is false when the transaction belongs to no shift', async () => {
    expect(await cashierShiftService.isTransactionLocked(null)).toBe(false);
    expect(await cashierShiftService.isTransactionLocked(undefined)).toBe(false);
  });

  it('is false while the shift is still open', async () => {
    await seedShift();
    expect(await cashierShiftService.isTransactionLocked(1)).toBe(false);
  });

  it('is true once the shift has been reconciled', async () => {
    await seedShift({ status: 'CLOSED', closed_at: new Date() });
    expect(await cashierShiftService.isTransactionLocked(1)).toBe(true);
  });
});
