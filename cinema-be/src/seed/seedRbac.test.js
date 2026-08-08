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

  it('does not grant branch admin ticket.create, booking.refund or review.moderate', async () => {
    await seedRbac();
    const branchAdmin = await Role.findOne({ code: 'BRANCH_ADMIN' });
    for (const code of ['ticket.create', 'booking.refund', 'review.moderate']) {
      const permission = await Permission.findOne({ code });
      const link = await RolePermission.findOne({ role_id: branchAdmin.id, permission_id: permission.id });
      expect(link).toBeNull();
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
