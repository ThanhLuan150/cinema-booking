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
    expect(invoice.created_by).toBeNull();
    expect(invoice.createdAt).toBeInstanceOf(Date);
    expect(invoice.ticket_status).toBe('ISSUED');
    expect(invoice.issued_at).toBeNull();
    expect(invoice.qr_token).toBeUndefined();
  });

  it('enforces a unique qr_token when set', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, qr_token: 'TCK-1' });
    await expect(
      Invoice.create({ id: 2, ticket_id: 2, account_id: 2, code: 'B', total_price: 2, qr_token: 'TCK-1' }),
    ).rejects.toThrow();
  });

  it('rejects an unrecognized ticket_status', () => {
    const err = new Invoice({
      id: 1,
      ticket_id: 1,
      account_id: 1,
      code: 'A',
      total_price: 1,
      ticket_status: 'BOGUS',
    }).validateSync();
    expect(err.errors.ticket_status).toBeDefined();
  });

  it('stores created_by when a counter sale is recorded', async () => {
    const invoice = await Invoice.create({
      id: 1,
      ticket_id: 1,
      account_id: 1,
      code: 'A',
      total_price: 1,
      created_by: 42,
    });
    expect(invoice.created_by).toBe(42);
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
