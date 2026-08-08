const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const RolePermission = require('./RolePermission');

beforeAll(async () => {
  await connect();
  await RolePermission.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('RolePermission model', () => {
  it('creates a valid link', async () => {
    const link = await RolePermission.create({ id: 1, role_id: 1, permission_id: 1 });
    expect(link.role_id).toBe(1);
    expect(link.permission_id).toBe(1);
  });

  it('enforces unique (role_id, permission_id) pair', async () => {
    await RolePermission.create({ id: 1, role_id: 1, permission_id: 1 });
    await expect(RolePermission.create({ id: 2, role_id: 1, permission_id: 1 })).rejects.toThrow();
  });

  it('allows the same permission on a different role', async () => {
    await RolePermission.create({ id: 1, role_id: 1, permission_id: 1 });
    await expect(RolePermission.create({ id: 2, role_id: 2, permission_id: 1 })).resolves.toBeDefined();
  });
});
