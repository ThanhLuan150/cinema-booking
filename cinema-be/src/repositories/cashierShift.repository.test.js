const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const CashierShift = require('../models/CashierShift');
const Payment = require('../models/Payment');
const ComboOrder = require('../models/ComboOrder');
const Refund = require('../models/Refund');
const cashierShiftRepository = require('./cashierShift.repository');

beforeAll(async () => {
  await connect();
  await CashierShift.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function openArgs(overrides = {}) {
  return { employeeId: 5, accountId: 50, branchId: 1, openingCash: 500000, openedBy: 50, ...overrides };
}

describe('open', () => {
  it('creates an OPEN shift stamped with the cashier, their account and their branch', async () => {
    const shift = await cashierShiftRepository.open(openArgs({ note: 'morning float' }));
    expect(shift).toMatchObject({
      employee_id: 5,
      account_id: 50,
      branch_id: 1,
      opening_cash: 500000,
      status: 'OPEN',
      opened_by: 50,
      open_note: 'morning float',
    });
    expect(shift.id).toBeGreaterThan(0);
  });

  it('refuses a second shift while one is still open', async () => {
    await cashierShiftRepository.open(openArgs());
    await expect(cashierShiftRepository.open(openArgs())).rejects.toBeInstanceOf(
      cashierShiftRepository.ShiftAlreadyOpenError,
    );
    expect(await CashierShift.countDocuments()).toBe(1);
  });

  it('lets only one of two concurrent opens win', async () => {
    const results = await Promise.allSettled([
      cashierShiftRepository.open(openArgs()),
      cashierShiftRepository.open(openArgs()),
      cashierShiftRepository.open(openArgs()),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const rejected of results.filter((r) => r.status === 'rejected')) {
      expect(rejected.reason).toBeInstanceOf(cashierShiftRepository.ShiftAlreadyOpenError);
    }
    expect(await CashierShift.countDocuments({ employee_id: 5, status: 'OPEN' })).toBe(1);
  });

  it('does not stop a different cashier opening their own drawer at the same time', async () => {
    await cashierShiftRepository.open(openArgs({ employeeId: 5, accountId: 50 }));
    await cashierShiftRepository.open(openArgs({ employeeId: 6, accountId: 60 }));
    expect(await CashierShift.countDocuments({ status: 'OPEN' })).toBe(2);
  });

  it('allows a fresh shift once the previous one has been closed', async () => {
    const first = await cashierShiftRepository.open(openArgs());
    await cashierShiftRepository.close(first.id, {
      cashSales: 0,
      cashRefunds: 0,
      expectedCash: 500000,
      actualCash: 500000,
      difference: 0,
      closedBy: 50,
    });
    await expect(cashierShiftRepository.open(openArgs())).resolves.toMatchObject({ status: 'OPEN' });
  });
});

describe('close', () => {
  it('writes the settlement figures and flips the shift to CLOSED', async () => {
    const shift = await cashierShiftRepository.open(openArgs());
    const closed = await cashierShiftRepository.close(shift.id, {
      cashSales: 590000,
      cashRefunds: 40000,
      expectedCash: 1050000,
      actualCash: 1040000,
      difference: -10000,
      closedBy: 50,
      note: 'short by 10k',
    });

    expect(closed).toMatchObject({
      status: 'CLOSED',
      cash_sales: 590000,
      cash_refunds: 40000,
      expected_cash: 1050000,
      actual_cash: 1040000,
      difference: -10000,
      closed_by: 50,
      close_note: 'short by 10k',
    });
    expect(closed.closed_at).toBeInstanceOf(Date);
  });

  // Guarded on status OPEN, so a retried or racing close can never overwrite a settled count.
  it('returns null for a second close and leaves the first settlement intact', async () => {
    const shift = await cashierShiftRepository.open(openArgs());
    const args = {
      cashSales: 0,
      cashRefunds: 0,
      expectedCash: 500000,
      actualCash: 500000,
      difference: 0,
      closedBy: 50,
    };
    await cashierShiftRepository.close(shift.id, args);

    expect(await cashierShiftRepository.close(shift.id, { ...args, actualCash: 9999999, difference: 9499999 })).toBeNull();
    expect((await CashierShift.findOne({ id: shift.id })).actual_cash).toBe(500000);
  });

  it('lets only one of two concurrent closes settle the drawer', async () => {
    const shift = await cashierShiftRepository.open(openArgs());
    const args = {
      cashSales: 0,
      cashRefunds: 0,
      expectedCash: 500000,
      actualCash: 500000,
      difference: 0,
      closedBy: 50,
    };

    const results = await Promise.all([
      cashierShiftRepository.close(shift.id, args),
      cashierShiftRepository.close(shift.id, args),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

// --- Transaction attribution ------------------------------------------------
// What does and does not land in a shift's cash totals.

describe('sumCashSales', () => {
  async function payment(overrides = {}) {
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

  async function comboOrder(overrides = {}) {
    return ComboOrder.create({
      id: overrides.id ?? 1,
      code: overrides.code ?? `CO-${overrides.id ?? 1}`,
      branch_id: 1,
      items: [{ combo_id: 1, name: 'Combo', unit_price: 90000, quantity: 1, line_total: 90000 }],
      total_price: 90000,
      status: 'PAID',
      payment_method: 'CASH',
      paid_at: new Date(),
      shift_id: 1,
      ...overrides,
    });
  }

  it('is zero for a shift with no transactions', async () => {
    expect(await cashierShiftRepository.sumCashSales(1)).toEqual({ ticketCash: 0, comboCash: 0, total: 0 });
  });

  it('splits ticket cash from combo cash and totals both', async () => {
    await payment({ id: 1, amount: 300000 });
    await payment({ id: 2, amount: 200000 });
    await comboOrder({ id: 1 });
    expect(await cashierShiftRepository.sumCashSales(1)).toEqual({
      ticketCash: 500000,
      comboCash: 90000,
      total: 590000,
    });
  });

  it('excludes non-cash methods', async () => {
    await payment({ id: 1, amount: 300000, method: 'CARD' });
    await payment({ id: 2, amount: 200000, method: 'QR_PAYMENT' });
    await payment({ id: 3, amount: 100000, method: 'MOMO', type: 'ONLINE' });
    await comboOrder({ id: 1, payment_method: 'MOMO' });
    expect((await cashierShiftRepository.sumCashSales(1)).total).toBe(0);
  });

  it('excludes a payment that never completed', async () => {
    await payment({ id: 1, amount: 300000, status: 'PENDING', paid_at: null });
    await payment({ id: 2, amount: 100000, status: 'FAILED', paid_at: null });
    expect((await cashierShiftRepository.sumCashSales(1)).total).toBe(0);
  });

  it('excludes rows belonging to another shift or to none at all', async () => {
    await payment({ id: 1, amount: 300000, shift_id: 2 });
    await payment({ id: 2, amount: 200000, shift_id: null });
    await comboOrder({ id: 1, shift_id: 2 });
    expect((await cashierShiftRepository.sumCashSales(1)).total).toBe(0);
  });

  it('excludes a cancelled combo order but keeps one already handed over', async () => {
    await comboOrder({ id: 1, status: 'CANCELLED', cancelled_at: new Date() });
    await comboOrder({ id: 2, code: 'CO-2', status: 'DELIVERED', total_price: 50000 });
    expect((await cashierShiftRepository.sumCashSales(1)).comboCash).toBe(50000);
  });
});

describe('sumCashRefunds', () => {
  async function refund(overrides = {}) {
    return Refund.create({
      id: overrides.id ?? 1,
      booking_id: 1,
      payment_id: 1,
      account_id: 10,
      branch_id: 1,
      amount: 100000,
      policy_percent: 100,
      status: 'COMPLETED',
      shift_id: 1,
      ...overrides,
    });
  }

  it('is zero for a shift that paid nothing back', async () => {
    expect(await cashierShiftRepository.sumCashRefunds(1)).toEqual({ total: 0 });
  });

  it('adds up every completed refund stamped with the shift', async () => {
    await refund({ id: 1, amount: 40000 });
    await refund({ id: 2, amount: 60000 });
    expect(await cashierShiftRepository.sumCashRefunds(1)).toEqual({ total: 100000 });
  });

  it('ignores refunds that are only requested, approved, processing, rejected or failed', async () => {
    await refund({ id: 1, status: 'REQUESTED' });
    await refund({ id: 2, status: 'APPROVED' });
    await refund({ id: 3, status: 'PROCESSING' });
    await refund({ id: 4, status: 'REJECTED' });
    await refund({ id: 5, status: 'FAILED' });
    expect((await cashierShiftRepository.sumCashRefunds(1)).total).toBe(0);
  });

  it('ignores refunds paid out of a different drawer', async () => {
    await refund({ id: 1, shift_id: 2 });
    await refund({ id: 2, shift_id: null });
    expect((await cashierShiftRepository.sumCashRefunds(1)).total).toBe(0);
  });
});

describe('lookups', () => {
  it('finds the open shift by employee and by account, and nothing once it is closed', async () => {
    const shift = await cashierShiftRepository.open(openArgs());
    expect((await cashierShiftRepository.findOpenByEmployee(5)).id).toBe(shift.id);
    expect((await cashierShiftRepository.findOpenByAccount(50)).id).toBe(shift.id);

    await cashierShiftRepository.close(shift.id, {
      cashSales: 0,
      cashRefunds: 0,
      expectedCash: 500000,
      actualCash: 500000,
      difference: 0,
      closedBy: 50,
    });
    expect(await cashierShiftRepository.findOpenByEmployee(5)).toBeNull();
    expect(await cashierShiftRepository.findOpenByAccount(50)).toBeNull();
  });

  it('resolves a shift’s branch, and null for an unknown shift', async () => {
    const shift = await cashierShiftRepository.open(openArgs({ branchId: 7 }));
    expect(await cashierShiftRepository.findBranchIdByShiftId(shift.id)).toBe(7);
    expect(await cashierShiftRepository.findBranchIdByShiftId(999)).toBeNull();
  });

  it('lists newest first and paginates', async () => {
    await cashierShiftRepository.open(openArgs({ employeeId: 5, accountId: 50 }));
    await cashierShiftRepository.open(openArgs({ employeeId: 6, accountId: 60 }));
    await cashierShiftRepository.open(openArgs({ employeeId: 7, accountId: 70 }));

    const { data, total } = await cashierShiftRepository.findFiltered({ branch_id: 1 }, { skip: 0, limit: 2 });
    expect(total).toBe(3);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBeGreaterThan(data[1].id);
  });
});
