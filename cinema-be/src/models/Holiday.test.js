const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Holiday = require('./Holiday');

beforeAll(async () => {
  await connect();
  await Holiday.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Holiday model', () => {
  it('creates a valid holiday and applies defaults', async () => {
    const holiday = await Holiday.create({ id: 1, date: '2026-09-02' });
    expect(holiday.name).toBe('');
    expect(holiday.branch_id).toBeNull();
  });

  it('fails validation when required fields are missing', () => {
    const err = new Holiday({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.date).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Holiday.create({ id: 1, date: '2026-09-02' });
    await expect(Holiday.create({ id: 1, date: '2026-09-03' })).rejects.toThrow();
  });

  it('enforces one holiday per (date, branch_id) pair, but allows the same date across different branches', async () => {
    await Holiday.create({ id: 1, date: '2026-09-02', branch_id: 1 });
    await expect(Holiday.create({ id: 2, date: '2026-09-02', branch_id: 1 })).rejects.toThrow();
    await expect(Holiday.create({ id: 3, date: '2026-09-02', branch_id: 2 })).resolves.toBeDefined();
    await expect(Holiday.create({ id: 4, date: '2026-09-02', branch_id: null })).resolves.toBeDefined();
  });

  it('toJSON strips _id and __v', async () => {
    const holiday = await Holiday.create({ id: 1, date: '2026-09-02' });
    const json = holiday.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
