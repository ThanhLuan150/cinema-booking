const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const seedRbac = require('./seedRbac');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('seedRbac', () => {
  it('creates the 4 roles', async () => {
    await seedRbac();
    const roles = await Role.find().sort({ legacy_role_number: 1 });
    expect(roles.map((r) => r.code)).toEqual(['SUPER_ADMIN', 'CUSTOMER', 'BRANCH_ADMIN', 'EMPLOYEE']);
  });

  it('grants super admin every seeded permission', async () => {
    await seedRbac();
    const superAdmin = await Role.findOne({ code: 'SUPER_ADMIN' });
    const permissionCount = await Permission.countDocuments();
    const links = await RolePermission.countDocuments({ role_id: superAdmin.id });
    expect(links).toBe(permissionCount);
  });

  it('does not grant employee cinema-write or employee-management permissions', async () => {
    await seedRbac();
    const employeeRole = await Role.findOne({ code: 'EMPLOYEE' });
    const employeeCreate = await Permission.findOne({ code: 'employee.create' });
    const link = await RolePermission.findOne({ role_id: employeeRole.id, permission_id: employeeCreate.id });
    expect(link).toBeNull();
  });

  it('is idempotent when run twice', async () => {
    await seedRbac();
    await seedRbac();
    expect(await Role.countDocuments()).toBe(4);
  });

  it('does not grant branch admin ticket.create, booking.refund, review.moderate or cinema.create', async () => {
    await seedRbac();
    const branchAdmin = await Role.findOne({ code: 'BRANCH_ADMIN' });
    for (const code of ['ticket.create', 'booking.refund', 'review.moderate', 'cinema.create']) {
      const permission = await Permission.findOne({ code });
      const link = await RolePermission.findOne({ role_id: branchAdmin.id, permission_id: permission.id });
      expect(link).toBeNull();
    }
  });

  it('assigns booking.read the scope from the RBAC doc\'s worked example (ALL/BRANCH/BRANCH/OWN)', async () => {
    await seedRbac();
    const permission = await Permission.findOne({ code: 'booking.read' });
    const expected = { SUPER_ADMIN: 'ALL', BRANCH_ADMIN: 'BRANCH', EMPLOYEE: 'BRANCH', CUSTOMER: 'OWN' };
    for (const [roleCode, scope] of Object.entries(expected)) {
      const role = await Role.findOne({ code: roleCode });
      const link = await RolePermission.findOne({ role_id: role.id, permission_id: permission.id });
      expect(link.scope).toBe(scope);
    }
  });

  it('updates an existing link\'s scope on the next run instead of only checking presence', async () => {
    await seedRbac();
    const branchAdmin = await Role.findOne({ code: 'BRANCH_ADMIN' });
    const permission = await Permission.findOne({ code: 'booking.read' });
    await RolePermission.updateOne({ role_id: branchAdmin.id, permission_id: permission.id }, { scope: 'ALL' });

    await seedRbac();

    const link = await RolePermission.findOne({ role_id: branchAdmin.id, permission_id: permission.id });
    expect(link.scope).toBe('BRANCH');
  });

  it('does not grant branch admin movie.create, movie.update or movie.delete', async () => {
    await seedRbac();
    const branchAdmin = await Role.findOne({ code: 'BRANCH_ADMIN' });
    for (const code of ['movie.create', 'movie.update', 'movie.delete']) {
      const permission = await Permission.findOne({ code });
      const link = await RolePermission.findOne({ role_id: branchAdmin.id, permission_id: permission.id });
      expect(link).toBeNull();
    }
  });

  it('grants movie.read (ALL scope) to every role including employee and customer', async () => {
    await seedRbac();
    const permission = await Permission.findOne({ code: 'movie.read' });
    for (const roleCode of ['SUPER_ADMIN', 'BRANCH_ADMIN', 'EMPLOYEE', 'CUSTOMER']) {
      const role = await Role.findOne({ code: roleCode });
      const link = await RolePermission.findOne({ role_id: role.id, permission_id: permission.id });
      expect(link).not.toBeNull();
      expect(link.scope).toBe('ALL');
    }
  });

  it('grants branch admin schedule.create/update/delete/cancel scoped to BRANCH', async () => {
    await seedRbac();
    const branchAdmin = await Role.findOne({ code: 'BRANCH_ADMIN' });
    for (const code of ['schedule.create', 'schedule.update', 'schedule.delete', 'schedule.cancel']) {
      const permission = await Permission.findOne({ code });
      const link = await RolePermission.findOne({ role_id: branchAdmin.id, permission_id: permission.id });
      expect(link).not.toBeNull();
      expect(link.scope).toBe('BRANCH');
    }
  });

  it('prunes a role-permission link that is no longer in the map on the next run', async () => {
    await seedRbac();
    const branchAdmin = await Role.findOne({ code: 'BRANCH_ADMIN' });
    const permission = await Permission.findOne({ code: 'booking.refund' });
    const id = await require('../utils/nextId')('rolePermission');
    await RolePermission.create({ id, role_id: branchAdmin.id, permission_id: permission.id });
    expect(await RolePermission.findOne({ role_id: branchAdmin.id, permission_id: permission.id })).not.toBeNull();

    await seedRbac();

    expect(await RolePermission.findOne({ role_id: branchAdmin.id, permission_id: permission.id })).toBeNull();
  });
});
