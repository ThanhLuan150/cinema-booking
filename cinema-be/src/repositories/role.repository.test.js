const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const roleRepository = require('./role.repository');
const Role = require('../models/Role');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('role.repository', () => {
  it('findByLegacyNumber finds the matching role', async () => {
    await Role.create({ id: 1, code: 'SUPER_ADMIN', legacy_role_number: 0, name: 'Super Admin' });
    const role = await roleRepository.findByLegacyNumber(0);
    expect(role.code).toBe('SUPER_ADMIN');
  });

  it('findByLegacyNumber returns null when not found', async () => {
    expect(await roleRepository.findByLegacyNumber(99)).toBeNull();
  });

  it('findByCode finds the matching role', async () => {
    await Role.create({ id: 1, code: 'EMPLOYEE', legacy_role_number: 3, name: 'Employee' });
    const role = await roleRepository.findByCode('EMPLOYEE');
    expect(role.legacy_role_number).toBe(3);
  });

  it('create persists a new role', async () => {
    const role = await roleRepository.create({ id: 1, code: 'CUSTOMER', legacy_role_number: 1, name: 'Customer' });
    expect(role.name).toBe('Customer');
  });
});
