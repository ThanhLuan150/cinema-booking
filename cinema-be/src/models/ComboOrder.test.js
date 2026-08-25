const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const ComboOrder = require('./ComboOrder');

beforeAll(async () => {
  await connect();
  await ComboOrder.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const baseItems = [{ combo_id: 1, name: 'Popcorn Combo', unit_price: 50000, quantity: 2, line_total: 100000 }];

describe('ComboOrder model', () => {
  it('creates a valid combo order and applies defaults', async () => {
    const order = await ComboOrder.create({
      id: 1,
      code: 'CO-1',
      branch_id: 1,
      items: baseItems,
      total_price: 100000,
    });
    expect(order.status).toBe('PENDING');
    expect(order.account_id).toBeNull();
    expect(order.booking_id).toBeNull();
    expect(order.payment_method).toBeNull();
    expect(order.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new ComboOrder({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.items).toBeDefined();
    expect(err.errors.total_price).toBeDefined();
  });

  it('rejects a status/payment_method outside their enum', () => {
    const base = { id: 1, code: 'CO-1', branch_id: 1, items: baseItems, total_price: 100000 };
    expect(new ComboOrder({ ...base, status: 'BOGUS' }).validateSync().errors.status).toBeDefined();
    expect(new ComboOrder({ ...base, payment_method: 'BOGUS' }).validateSync().errors.payment_method).toBeDefined();
  });

  it('enforces unique id and unique code', async () => {
    await ComboOrder.create({ id: 1, code: 'CO-1', branch_id: 1, items: baseItems, total_price: 100000 });
    await expect(
      ComboOrder.create({ id: 2, code: 'CO-1', branch_id: 1, items: baseItems, total_price: 100000 }),
    ).rejects.toThrow();
    await expect(
      ComboOrder.create({ id: 1, code: 'CO-2', branch_id: 1, items: baseItems, total_price: 100000 }),
    ).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const order = await ComboOrder.create({ id: 1, code: 'CO-1', branch_id: 1, items: baseItems, total_price: 100000 });
    const json = order.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });

  it('exposes the STATUS and CANCELLABLE_STATUSES constants', () => {
    expect(ComboOrder.STATUS).toEqual({
      PENDING: 'PENDING',
      PAID: 'PAID',
      PREPARING: 'PREPARING',
      READY: 'READY',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
    });
    expect(ComboOrder.CANCELLABLE_STATUSES).toEqual(['PENDING', 'PAID', 'PREPARING']);
  });
});
