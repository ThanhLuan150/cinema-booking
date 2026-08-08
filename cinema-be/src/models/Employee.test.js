const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Employee = require('./Employee');

beforeAll(async () => {
  await connect();
  await Employee.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Employee model', () => {
  it('creates a valid employee with defaults', async () => {
    const employee = await Employee.create({
      id: 1,
      user_id: 10,
      branch_id: 1,
      employee_code: 'EMP-000001',
      position_id: 1,
    });
    expect(employee.status).toBe(1);
    expect(employee.employee_code).toBe('EMP-000001');
  });

  it('fails validation when required fields are missing', () => {
    const err = new Employee({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.user_id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.employee_code).toBeDefined();
    expect(err.errors.position_id).toBeDefined();
  });

  it('enforces unique user_id (one employee record per account)', async () => {
    await Employee.create({ id: 1, user_id: 10, branch_id: 1, employee_code: 'EMP-000001', position_id: 1 });
    await expect(
      Employee.create({ id: 2, user_id: 10, branch_id: 2, employee_code: 'EMP-000002', position_id: 1 }),
    ).rejects.toThrow();
  });
});
