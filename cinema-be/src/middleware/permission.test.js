const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { requirePermission, requireCinemaAccess } = require('./permission');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const Cinema = require('../models/Cinema');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const PositionPermission = require('../models/PositionPermission');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requirePermission', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requirePermission('employee.create')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the role has no matching Role record', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requirePermission('employee.create')({ account: { role: 0, accountId: 1 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 403 when the role lacks the permission', async () => {
    await Role.create({ id: 1, code: 'CUSTOMER', legacy_role_number: 1, name: 'Customer' });
    const res = mockRes();
    const next = jest.fn();
    await requirePermission('employee.create')({ account: { role: 1, accountId: 1 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next when the role has the permission', async () => {
    const role = await Role.create({ id: 1, code: 'BRANCH_ADMIN', legacy_role_number: 2, name: 'Branch Admin' });
    const permission = await Permission.create({ id: 1, code: 'employee.create', module: 'employee' });
    await RolePermission.create({ id: 1, role_id: role.id, permission_id: permission.id });

    const res = mockRes();
    const next = jest.fn();
    const req = { account: { role: 2, accountId: 1 } };
    await requirePermission('employee.create')(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('attaches the granted scope as req.permissionScope', async () => {
    const role = await Role.create({ id: 1, code: 'BRANCH_ADMIN', legacy_role_number: 2, name: 'Branch Admin' });
    const permission = await Permission.create({ id: 1, code: 'booking.read', module: 'booking' });
    await RolePermission.create({ id: 1, role_id: role.id, permission_id: permission.id, scope: 'BRANCH' });

    const res = mockRes();
    const next = jest.fn();
    const req = { account: { role: 2, accountId: 1 } };
    await requirePermission('booking.read')(req, res, next);
    expect(req.permissionScope).toBe('BRANCH');
    expect(req.roleCode).toBe('BRANCH_ADMIN');
  });
});

describe('requireCinemaAccess', () => {
  it('returns 404 when the cinema cannot be resolved', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireCinemaAccess(() => null)({ account: { role: 0 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lets an ALL-scope caller (super admin) bypass ownership checks', async () => {
    const res = mockRes();
    const next = jest.fn();
    const req = { account: { role: 0, accountId: 99 }, permissionScope: 'ALL' };
    await requireCinemaAccess(() => 1)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.cinemaId).toBe(1);
  });

  it('returns 404 when the cinema does not exist for a non-admin role', async () => {
    const res = mockRes();
    const next = jest.fn();
    await requireCinemaAccess(() => 1)({ account: { role: 2, accountId: 1 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids a branch admin who does not own the cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = mockRes();
    const next = jest.fn();
    await requireCinemaAccess(() => 1)({ account: { role: 2, accountId: 1 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a branch admin who owns the cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = mockRes();
    const next = jest.fn();
    const req = { account: { role: 2, accountId: 42 } };
    await requireCinemaAccess(() => 1)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.cinema.owner_id).toBe(42);
  });

  it('forbids an employee not staffed at the cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = mockRes();
    const next = jest.fn();
    await requireCinemaAccess(() => 1)({ account: { role: 3, accountId: 7 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows an employee actively staffed at the cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 1 });
    const res = mockRes();
    const next = jest.fn();
    const req = { account: { role: 3, accountId: 7 } };
    await requireCinemaAccess(() => 1)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.employee.user_id).toBe(7);
  });

  it('forbids an employee deactivated at the cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 0 });
    const res = mockRes();
    const next = jest.fn();
    await requireCinemaAccess(() => 1)({ account: { role: 3, accountId: 7 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('forbids an unknown role number', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = mockRes();
    const next = jest.fn();
    await requireCinemaAccess(() => 1)({ account: { role: 9, accountId: 1 } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requirePermission — Position fallback for EMPLOYEE role', () => {
  async function seedEmployeeRole() {
    return Role.create({ id: 1, code: 'EMPLOYEE', legacy_role_number: 3, name: 'Employee' });
  }

  it('grants access via the employee\'s Position when the EMPLOYEE role itself has no RolePermission', async () => {
    await seedEmployeeRole();
    const permission = await Permission.create({ id: 1, code: 'booking.create', module: 'booking' });
    const position = await Position.create({ id: 1, code: 'TICKET_STAFF', name: 'Ticket Staff', status: 1 });
    await PositionPermission.create({ id: 1, position_id: position.id, permission_id: permission.id, scope: 'BRANCH' });
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: position.id, status: 1 });

    const res = mockRes();
    const next = jest.fn();
    const req = { account: { role: 3, accountId: 7 } };
    await requirePermission('booking.create')(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.permissionScope).toBe('BRANCH');
  });

  it('denies access when the employee\'s Position does not grant the permission (e.g. Security)', async () => {
    await seedEmployeeRole();
    await Permission.create({ id: 1, code: 'booking.create', module: 'booking' });
    const position = await Position.create({ id: 1, code: 'SECURITY', name: 'Security', status: 1 });
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: position.id, status: 1 });

    const res = mockRes();
    const next = jest.fn();
    const req = { account: { role: 3, accountId: 7 } };
    await requirePermission('booking.create')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies access when the employee has no Employee profile at all', async () => {
    await seedEmployeeRole();
    await Permission.create({ id: 1, code: 'booking.create', module: 'booking' });
    // Employee record intentionally omitted — an EMPLOYEE-role account with no Employee
    // profile at all must still be denied rather than throwing.

    const res = mockRes();
    const next = jest.fn();
    const req = { account: { role: 3, accountId: 7 } };
    await requirePermission('booking.create')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
