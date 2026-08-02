const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Voucher = require('./Voucher');

beforeAll(async () => {
  await connect();
  await Voucher.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Voucher model', () => {
  it('creates a valid voucher and applies defaults', async () => {
    const voucher = await Voucher.create({
      id: 1,
      code: 'save10',
      discount_type: 'percent',
      discount_value: 10,
    });
    expect(voucher.code).toBe('SAVE10'); // uppercased
    expect(voucher.cinema_id).toBeNull();
    expect(voucher.max_uses).toBeNull();
    expect(voucher.used_count).toBe(0);
    expect(voucher.valid_from).toBeNull();
    expect(voucher.valid_to).toBeNull();
    expect(voucher.min_order_value).toBe(0);
    expect(voucher.active).toBe(true);
    expect(voucher.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Voucher({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.discount_type).toBeDefined();
    expect(err.errors.discount_value).toBeDefined();
  });

  it('rejects a discount_type outside the enum', () => {
    const voucher = new Voucher({
      id: 1,
      code: 'X',
      discount_type: 'invalid',
      discount_value: 1,
    });
    const err = voucher.validateSync();
    expect(err.errors.discount_type).toBeDefined();
  });

  it('enforces unique id and code', async () => {
    await Voucher.create({ id: 1, code: 'A', discount_type: 'fixed', discount_value: 1 });
    await expect(
      Voucher.create({ id: 1, code: 'B', discount_type: 'fixed', discount_value: 2 }),
    ).rejects.toThrow();
    await expect(
      Voucher.create({ id: 2, code: 'A', discount_type: 'fixed', discount_value: 2 }),
    ).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const voucher = await Voucher.create({ id: 1, code: 'A', discount_type: 'fixed', discount_value: 1 });
    const json = voucher.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
