const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const rolePermissionRepository = require('./rolePermission.repository');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('rolePermission.repository', () => {
  it('roleHasPermission is true when the link exists', async () => {
    await Permission.create({ id: 1, code: 'employee.create', module: 'employee' });
    await RolePermission.create({ id: 1, role_id: 5, permission_id: 1 });
    expect(await rolePermissionRepository.roleHasPermission(5, 'employee.create')).toBe(true);
  });

  it('roleHasPermission is false when the link does not exist', async () => {
    await Permission.create({ id: 1, code: 'employee.create', module: 'employee' });
    expect(await rolePermissionRepository.roleHasPermission(5, 'employee.create')).toBe(false);
  });

  it('roleHasPermission is false for an unknown permission code', async () => {
    expect(await rolePermissionRepository.roleHasPermission(5, 'unknown.code')).toBe(false);
  });

  it('findPermissionCodesForRole returns all codes granted to a role', async () => {
    await Permission.create([
      { id: 1, code: 'employee.create', module: 'employee' },
      { id: 2, code: 'employee.read', module: 'employee' },
    ]);
    await RolePermission.create([
      { id: 1, role_id: 5, permission_id: 1 },
      { id: 2, role_id: 5, permission_id: 2 },
    ]);
    const codes = await rolePermissionRepository.findPermissionCodesForRole(5);
    expect(codes.sort()).toEqual(['employee.create', 'employee.read']);
  });

  it('findScopeForRolePermission returns the granted scope', async () => {
    await Permission.create({ id: 1, code: 'booking.read', module: 'booking' });
    await RolePermission.create({ id: 1, role_id: 5, permission_id: 1, scope: 'BRANCH' });
    expect(await rolePermissionRepository.findScopeForRolePermission(5, 'booking.read')).toBe('BRANCH');
  });

  it('findScopeForRolePermission returns null when the role lacks the permission', async () => {
    await Permission.create({ id: 1, code: 'booking.read', module: 'booking' });
    expect(await rolePermissionRepository.findScopeForRolePermission(5, 'booking.read')).toBeNull();
  });

  it('findScopeForRolePermission returns null for an unknown permission code', async () => {
    expect(await rolePermissionRepository.findScopeForRolePermission(5, 'unknown.code')).toBeNull();
  });
});
