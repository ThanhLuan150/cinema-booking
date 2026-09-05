const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const VoucherUsage = require('./VoucherUsage');

beforeAll(async () => {
  await connect();
  await VoucherUsage.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('VoucherUsage model', () => {
  it('creates a valid usage row and applies defaults', async () => {
    const usage = await VoucherUsage.create({ id: 1, voucher_id: 1, account_id: 42 });
    expect(usage.booking_id).toBeNull();
    expect(usage.discount_amount).toBe(0);
    expect(usage.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new VoucherUsage({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.voucher_id).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
  });

  it('toJSON strips _id and __v', async () => {
    const usage = await VoucherUsage.create({ id: 1, voucher_id: 1, account_id: 42 });
    const json = usage.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
