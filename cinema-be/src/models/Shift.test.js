const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Shift = require('./Shift');

beforeAll(async () => {
  await connect();
  await Shift.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Shift model', () => {
  it('creates a valid shift and round-trips fields', async () => {
    const shift = await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    expect(shift.branch_id).toBe(1);
    expect(shift.name).toBe('Ca sáng');
    expect(shift.start_time).toBe('08:00');
    expect(shift.end_time).toBe('16:00');
    expect(shift.status).toBe('ACTIVE');
    expect(shift.createdAt).toBeInstanceOf(Date);
  });

  it('allows an overnight shift where end_time is earlier than start_time', async () => {
    const shift = await Shift.create({ id: 1, branch_id: 1, name: 'Ca đêm', start_time: '16:00', end_time: '00:00' });
    expect(shift.start_time).toBe('16:00');
    expect(shift.end_time).toBe('00:00');
  });

  it('fails validation when required fields are missing', () => {
    const err = new Shift({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.start_time).toBeDefined();
    expect(err.errors.end_time).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new Shift({
      id: 1,
      branch_id: 1,
      name: 'Ca sáng',
      start_time: '08:00',
      end_time: '16:00',
      status: 'BOGUS',
    }).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    await expect(
      Shift.create({ id: 1, branch_id: 1, name: 'Ca chiều', start_time: '16:00', end_time: '00:00' }),
    ).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const shift = await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    const json = shift.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
