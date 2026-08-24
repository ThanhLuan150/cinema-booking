const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Payment = require('./Payment');

beforeAll(async () => {
  await connect();
  await Payment.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const base = {
  id: 1,
  code: 'BK-1',
  booking_id: 1,
  account_id: 1,
  type: 'ONLINE',
  method: 'MOMO',
  amount: 100000,
};

describe('Payment model', () => {
  it('creates a valid payment and applies defaults', async () => {
    const payment = await Payment.create(base);
    expect(payment.status).toBe('PENDING');
    expect(payment.branch_id).toBeNull();
    expect(payment.idempotency_key).toBeUndefined();
    expect(payment.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Payment({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.booking_id).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.method).toBeDefined();
    expect(err.errors.amount).toBeDefined();
  });

  it('rejects a status/type/method outside their enum', () => {
    expect(new Payment({ ...base, status: 'BOGUS' }).validateSync().errors.status).toBeDefined();
    expect(new Payment({ ...base, type: 'BOGUS' }).validateSync().errors.type).toBeDefined();
    expect(new Payment({ ...base, method: 'BOGUS' }).validateSync().errors.method).toBeDefined();
  });

  it('enforces unique id and unique code', async () => {
    await Payment.create(base);
    await expect(Payment.create({ ...base, code: 'BK-2' })).rejects.toThrow();
    await expect(Payment.create({ ...base, id: 2 })).rejects.toThrow();
  });

  it('enforces unique idempotency_key and gateway_transaction_id when set, but allows many nulls', async () => {
    await Payment.create({ ...base, idempotency_key: 'idem-1', gateway_transaction_id: 'tx-1' });
    await Payment.create({ ...base, id: 2, code: 'BK-2' });
    await Payment.create({ ...base, id: 3, code: 'BK-3' });
    await expect(
      Payment.create({ ...base, id: 4, code: 'BK-4', idempotency_key: 'idem-1' }),
    ).rejects.toThrow();
    await expect(
      Payment.create({ ...base, id: 5, code: 'BK-5', gateway_transaction_id: 'tx-1' }),
    ).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const payment = await Payment.create(base);
    const json = payment.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });

  it('exposes the STATUS, TYPE and METHOD constants', () => {
    expect(Payment.STATUS).toEqual({
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      PAID: 'PAID',
      FAILED: 'FAILED',
      REFUND_PENDING: 'REFUND_PENDING',
      REFUNDED: 'REFUNDED',
    });
    expect(Payment.TYPE).toEqual({ ONLINE: 'ONLINE', COUNTER: 'COUNTER' });
    expect(Payment.METHOD).toEqual({ MOMO: 'MOMO', CASH: 'CASH' });
  });
});
