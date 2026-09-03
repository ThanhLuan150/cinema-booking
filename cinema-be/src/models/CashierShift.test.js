const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const CashierShift = require('./CashierShift');

beforeAll(async () => {
  await connect();
  await CashierShift.init(); // build the partial unique index before tests rely on it
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, employee_id: 5, account_id: 50, branch_id: 1, opening_cash: 500000, ...overrides };
}

describe('CashierShift model', () => {
  it('opens as OPEN with every settlement figure still unknown', async () => {
    const shift = await CashierShift.create(baseFields());
    expect(shift.status).toBe('OPEN');
    expect(shift.opened_at).toBeInstanceOf(Date);
    expect(shift.closed_at).toBeNull();
    expect(shift.cash_sales).toBeNull();
    expect(shift.cash_refunds).toBeNull();
    expect(shift.expected_cash).toBeNull();
    expect(shift.actual_cash).toBeNull();
    expect(shift.difference).toBeNull();
  });

  it('requires id, employee_id, account_id, branch_id and opening_cash', () => {
    const err = new CashierShift({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.employee_id).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.opening_cash).toBeDefined();
  });

  it('rejects a negative opening float and an unknown status', () => {
    expect(new CashierShift(baseFields({ opening_cash: -1 })).validateSync().errors.opening_cash).toBeDefined();
    expect(new CashierShift(baseFields({ status: 'PAUSED' })).validateSync().errors.status).toBeDefined();
  });

  it('refuses a second OPEN shift for the same cashier', async () => {
    await CashierShift.create(baseFields({ id: 1 }));
    await expect(CashierShift.create(baseFields({ id: 2 }))).rejects.toThrow();
  });

  it('lets a different cashier hold their own OPEN shift at the same time', async () => {
    await CashierShift.create(baseFields({ id: 1, employee_id: 5, account_id: 50 }));
    await CashierShift.create(baseFields({ id: 2, employee_id: 6, account_id: 60 }));
    expect(await CashierShift.countDocuments({ status: 'OPEN' })).toBe(2);
  });

  it('lets one cashier accumulate any number of CLOSED shifts alongside one OPEN one', async () => {
    await CashierShift.create(baseFields({ id: 1, status: 'CLOSED' }));
    await CashierShift.create(baseFields({ id: 2, status: 'CLOSED' }));
    await CashierShift.create(baseFields({ id: 3 }));
    expect(await CashierShift.countDocuments({ employee_id: 5 })).toBe(3);
  });

  it('frees the cashier to open a new shift once the previous one is closed', async () => {
    const first = await CashierShift.create(baseFields({ id: 1 }));
    first.status = 'CLOSED';
    await first.save();
    await expect(CashierShift.create(baseFields({ id: 2 }))).resolves.toBeDefined();
  });

  it('strips _id and __v when serialised', async () => {
    const json = (await CashierShift.create(baseFields())).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBe(1);
  });
});
