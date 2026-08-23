const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Booking = require('./Booking');

beforeAll(async () => {
  await connect();
  await Booking.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const base = { id: 1, code: 'BK-1', account_id: 1, schedule_id: 1, branch_id: 1, total_price: 100000 };

describe('Booking model', () => {
  it('creates a valid booking and applies defaults', async () => {
    const booking = await Booking.create(base);
    expect(booking.status).toBe('PENDING');
    expect(booking.ticket_ids).toEqual([]);
    expect(booking.combo_ids).toEqual([]);
    expect(booking.discount_amount).toBe(0);
    expect(booking.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Booking({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
    expect(err.errors.schedule_id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.total_price).toBeDefined();
  });

  it('rejects a status outside the enum', () => {
    const err = new Booking({ ...base, status: 'BOGUS' }).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id and unique code', async () => {
    await Booking.create(base);
    await expect(Booking.create({ ...base, code: 'BK-2' })).rejects.toThrow();
    await expect(Booking.create({ ...base, id: 2 })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const booking = await Booking.create(base);
    const json = booking.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });

  it('exposes the STATUS constants', () => {
    expect(Booking.STATUS).toEqual({
      PENDING: 'PENDING',
      PAID: 'PAID',
      CANCELLED: 'CANCELLED',
      EXPIRED: 'EXPIRED',
      COMPLETED: 'COMPLETED',
    });
  });
});
