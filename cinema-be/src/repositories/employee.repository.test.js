const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const employeeRepository = require('./employee.repository');
const Employee = require('../models/Employee');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('employee.repository', () => {
  it('findActiveByAccountAndCinema finds an active match', async () => {
    await Employee.create({ id: 1, account_id: 10, cinema_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 1 });
    const employee = await employeeRepository.findActiveByAccountAndCinema(10, 1);
    expect(employee).not.toBeNull();
  });

  it('findActiveByAccountAndCinema returns null for a deactivated employee', async () => {
    await Employee.create({ id: 1, account_id: 10, cinema_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 0 });
    expect(await employeeRepository.findActiveByAccountAndCinema(10, 1)).toBeNull();
  });

  it('findActiveByAccountAndCinema returns null for the wrong cinema', async () => {
    await Employee.create({ id: 1, account_id: 10, cinema_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 1 });
    expect(await employeeRepository.findActiveByAccountAndCinema(10, 2)).toBeNull();
  });

  it('findAll paginates and filters by cinema_id', async () => {
    await Employee.create([
      { id: 1, account_id: 10, cinema_id: 1, employee_code: 'EMP-000001', position_id: 1 },
      { id: 2, account_id: 11, cinema_id: 1, employee_code: 'EMP-000002', position_id: 1 },
      { id: 3, account_id: 12, cinema_id: 2, employee_code: 'EMP-000003', position_id: 1 },
    ]);
    const result = await employeeRepository.findAll({ cinema_id: 1 }, { skip: 0, limit: 20 });
    expect(result.total).toBe(2);
  });

  it('create persists a new employee', async () => {
    const employee = await employeeRepository.create({
      id: 1,
      account_id: 10,
      cinema_id: 1,
      employee_code: 'EMP-000001',
      position_id: 2,
    });
    expect(employee.position_id).toBe(2);
  });

  it('updateFields updates and returns the new document', async () => {
    await Employee.create({ id: 1, account_id: 10, cinema_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 1 });
    const updated = await employeeRepository.updateFields(1, { status: 0 });
    expect(updated.status).toBe(0);
  });
});
