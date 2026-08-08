const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const permissionRepository = require('./permission.repository');
const Permission = require('../models/Permission');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('permission.repository', () => {
  it('findByCode finds the matching permission', async () => {
    await Permission.create({ id: 1, code: 'employee.create', module: 'employee' });
    const permission = await permissionRepository.findByCode('employee.create');
    expect(permission.module).toBe('employee');
  });

  it('findByCode returns null when not found', async () => {
    expect(await permissionRepository.findByCode('nope')).toBeNull();
  });

  it('create persists a new permission', async () => {
    const permission = await permissionRepository.create({ id: 1, code: 'actor.read', module: 'actor' });
    expect(permission.code).toBe('actor.read');
  });
});
