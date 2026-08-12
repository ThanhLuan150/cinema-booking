const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const ShiftAssignment = require('./ShiftAssignment');

beforeAll(async () => {
  await connect();
  await ShiftAssignment.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    employee_id: 1,
    shift_id: 1,
    branch_id: 1,
    date: '2026-01-10',
    start_at: new Date('2026-01-10T08:00:00'),
    end_at: new Date('2026-01-10T16:00:00'),
    ...overrides,
  };
}

describe('ShiftAssignment model', () => {
  it('creates a valid assignment and round-trips fields', async () => {
    const assignment = await ShiftAssignment.create(baseFields());
    expect(assignment.employee_id).toBe(1);
    expect(assignment.shift_id).toBe(1);
    expect(assignment.branch_id).toBe(1);
    expect(assignment.date).toBe('2026-01-10');
    expect(assignment.status).toBe('ACTIVE');
    expect(assignment.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new ShiftAssignment({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.employee_id).toBeDefined();
    expect(err.errors.shift_id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.date).toBeDefined();
    expect(err.errors.start_at).toBeDefined();
    expect(err.errors.end_at).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new ShiftAssignment(baseFields({ status: 'BOGUS' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id', async () => {
    await ShiftAssignment.create(baseFields());
    await expect(ShiftAssignment.create(baseFields({ id: 1 }))).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const assignment = await ShiftAssignment.create(baseFields());
    const json = assignment.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
