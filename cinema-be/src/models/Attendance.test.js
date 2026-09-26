const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Attendance = require('./Attendance');

beforeAll(async () => {
  await connect();
  await Attendance.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    employee_id: 1,
    branch_id: 1,
    work_date: '2026-09-26',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'PRESENT',
    ...overrides,
  };
}

describe('Attendance model', () => {
  it('creates a row with null clock/break timestamps by default', async () => {
    const row = await Attendance.create(baseFields());
    expect(row.clock_in).toBeNull();
    expect(row.clock_out).toBeNull();
    expect(row.break_start).toBeNull();
    expect(row.break_end).toBeNull();
    expect(row.shift_assignment_id).toBeNull();
    expect(row.recorded_by).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('exposes the four statuses from the ticket', () => {
    expect(Attendance.STATUSES).toEqual(['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE']);
  });

  it.each(['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'])('accepts status %s', (status) => {
    expect(new Attendance(baseFields({ status })).validateSync()).toBeUndefined();
  });

  it('rejects an unknown status', () => {
    expect(new Attendance(baseFields({ status: 'HOLIDAY' })).validateSync().errors.status).toBeDefined();
  });

  it('requires id, employee, branch, work_date, timezone and status', () => {
    const err = new Attendance({}).validateSync();
    for (const field of ['id', 'employee_id', 'branch_id', 'work_date', 'timezone', 'status']) {
      expect(err.errors[field]).toBeDefined();
    }
  });

  it('allows only one row per employee per work day', async () => {
    await Attendance.create(baseFields());
    await expect(Attendance.create(baseFields({ id: 2 }))).rejects.toThrow(/duplicate key/);
  });

  it('allows the same employee on another day, and another employee on the same day', async () => {
    await Attendance.create(baseFields());
    await Attendance.create(baseFields({ id: 2, work_date: '2026-09-27' }));
    await Attendance.create(baseFields({ id: 3, employee_id: 2 }));
    expect(await Attendance.countDocuments()).toBe(3);
  });

  it('enforces a unique id', async () => {
    await Attendance.create(baseFields());
    await expect(Attendance.create(baseFields({ employee_id: 2 }))).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const json = (await Attendance.create(baseFields())).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBe(1);
  });
});
