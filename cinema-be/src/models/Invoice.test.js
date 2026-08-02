const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Invoice = require('./Invoice');

beforeAll(async () => {
  await connect();
  await Invoice.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Invoice model', () => {
  it('creates a valid invoice and applies defaults', async () => {
    const invoice = await Invoice.create({
      id: 1,
      ticket_id: 1,
      account_id: 1,
      code: 'INV-1',
      total_price: 100000,
    });
    expect(invoice.combo_ids).toEqual([]);
    expect(invoice.voucher_code).toBeNull();
    expect(invoice.discount_amount).toBe(0);
    expect(invoice.status).toBe(1);
    expect(invoice.checked_in).toBe(false);
    expect(invoice.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Invoice({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.ticket_id).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.total_price).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1 });
    await expect(
      Invoice.create({ id: 1, ticket_id: 2, account_id: 2, code: 'B', total_price: 2 }),
    ).rejects.toThrow();
  });

  it('stores an array of combo ids', async () => {
    const invoice = await Invoice.create({
      id: 1,
      ticket_id: 1,
      account_id: 1,
      code: 'A',
      total_price: 1,
      combo_ids: [1, 2, 3],
    });
    expect(invoice.combo_ids).toEqual([1, 2, 3]);
  });

  it('toJSON strips _id and __v', async () => {
    const invoice = await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1 });
    const json = invoice.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
