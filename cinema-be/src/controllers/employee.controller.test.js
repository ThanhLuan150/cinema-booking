const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const employeeController = require('./employee.controller');
const Employee = require('../models/Employee');
const Account = require('../models/Account');
const Position = require('../models/Position');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('employee.controller', () => {
  describe('create', () => {
    it('rejects missing email or password', async () => {
      const res = mockRes();
      await employeeController.create({ body: {}, branchId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a malformed email and a too-short password', async () => {
      const bad = mockRes();
      await employeeController.create({ body: { email: 'nope', password: 'secret123', position_id: 1 }, branchId: 1 }, bad);
      expect(bad.status).toHaveBeenCalledWith(400);
      expect(bad.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_EMAIL' }));

      const short = mockRes();
      await employeeController.create({ body: { email: 'a@b.com', password: '12345', position_id: 1 }, branchId: 1 }, short);
      expect(short.status).toHaveBeenCalledWith(400);
      expect(short.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PASSWORD_TOO_SHORT' }));
    });

    it('accepts an email whose local part or domain contains the letter s', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      const res = mockRes();
      await employeeController.create(
        { body: { email: 'sam.smith@studios.example.com', password: 'secret123', position_id: 1 }, branchId: 1 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('rejects a missing position_id', async () => {
      const res = mockRes();
      await employeeController.create({ body: { email: 'a@b.com', password: 'secret123' }, branchId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a position_id that does not exist', async () => {
      const res = mockRes();
      await employeeController.create(
        { body: { email: 'a@b.com', password: 'secret123', position_id: 999 }, branchId: 1 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_POSITION' }));
    });

    it('rejects a duplicate email', async () => {
      await Position.create({ id: 1, code: 'TICKET_STAFF', name: 'Ticket Staff', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3 });
      const res = mockRes();
      await employeeController.create(
        { body: { email: 'a@b.com', password: 'secret123', position_id: 1 }, branchId: 1 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('creates an account (role 3) and an employee record with a generated employee_code', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      const res = mockRes();
      await employeeController.create(
        { body: { email: 'staff@cinema.com', password: 'secret123', name: 'Staff One', position_id: 1 }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const account = await Account.findOne({ email: 'staff@cinema.com' });
      expect(account.role).toBe(3);
      expect(account.approved).toBe(true);
      const employee = await Employee.findOne({ user_id: account.id });
      expect(employee.branch_id).toBe(5);
      expect(employee.position_id).toBe(1);
      expect(employee.employee_code).toMatch(/^EMP-\d{6}$/);
    });

    it('ignores a role field in the body — every employee created here is role 3', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      const res = mockRes();
      await employeeController.create(
        {
          body: { email: 'staff2@cinema.com', password: 'secret123', position_id: 1, role: 0 },
          branchId: 5,
        },
        res,
      );
      const account = await Account.findOne({ email: 'staff2@cinema.com' });
      expect(account.role).toBe(3);
    });
  });

  describe('list', () => {
    it('returns employees scoped to req.branchId enriched with account info and position', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3, name: 'A' });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      await Employee.create({ id: 2, user_id: 2, branch_id: 9, employee_code: 'EMP-000002', position_id: 1 });
      const res = mockRes();
      await employeeController.list({ query: {}, branchId: 5 }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.total).toBe(1);
      expect(payload.data[0].email).toBe('a@b.com');
      expect(payload.data[0].position).toEqual({ code: 'CASHIER', name: 'Cashier' });
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown employee', async () => {
      const res = mockRes();
      await employeeController.update({ params: { id: 999 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a position_id that does not exist', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3 });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      const res = mockRes();
      await employeeController.update({ params: { id: 1 }, body: { position_id: 999 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('refuses to let the caller modify their own record', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Position.create({ id: 2, code: 'USHER', name: 'Usher', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3 });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      const res = mockRes();
      await employeeController.update({ params: { id: 1 }, account: { accountId: 1 }, body: { position_id: 2 } }, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SELF_MODIFICATION_FORBIDDEN' }));
      expect((await Employee.findOne({ id: 1 })).position_id).toBe(1);
    });

    it('refuses a target whose account is not an employee account', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'root@b.com', password: 'x', role: 0 });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      const res = mockRes();
      await employeeController.update({ params: { id: 1 }, account: { accountId: 9 }, body: { status: 0 } }, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_AN_EMPLOYEE_ACCOUNT' }));
    });

    it('rejects a status outside 0/1 and an update with nothing to change', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3 });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      const badStatus = mockRes();
      await employeeController.update({ params: { id: 1 }, body: { status: 2 } }, badStatus);
      expect(badStatus.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_STATUS' }));
      const empty = mockRes();
      await employeeController.update({ params: { id: 1 }, body: {} }, empty);
      expect(empty.status).toHaveBeenCalledWith(400);
    });

    it('updates position_id and status', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Position.create({ id: 2, code: 'SHIFT_SUPERVISOR', name: 'Shift Supervisor', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3 });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      const res = mockRes();
      await employeeController.update({ params: { id: 1 }, body: { position_id: 2, status: 0 } }, res);
      const updated = await Employee.findOne({ id: 1 });
      expect(updated.position_id).toBe(2);
      expect(updated.status).toBe(0);
    });
  });

  describe('remove', () => {
    it('deactivates the employee and locks the account', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3, status: 1 });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      const res = mockRes();
      await employeeController.remove({ params: { id: 1 } }, res);
      expect(await Employee.findOne({ id: 1 })).toHaveProperty('status', 0);
      expect(await Account.findOne({ id: 1 })).toHaveProperty('status', 0);
    });
  });

  describe('resetPassword', () => {
    it('refuses to reset the password of a non-employee account or of the caller', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'root@b.com', password: 'rootpw', role: 0 });
      await Account.create({ id: 2, email: 'e@b.com', password: 'emppw', role: 3 });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      await Employee.create({ id: 2, user_id: 2, branch_id: 5, employee_code: 'EMP-000002', position_id: 1 });

      const root = mockRes();
      await employeeController.resetPassword({ params: { id: 1 }, account: { accountId: 9 } }, root);
      expect(root.status).toHaveBeenCalledWith(403);

      const self = mockRes();
      await employeeController.resetPassword({ params: { id: 2 }, account: { accountId: 2 } }, self);
      expect(self.status).toHaveBeenCalledWith(403);

      expect((await Account.findOne({ id: 1 }).select('+password')).password).toBe('rootpw');
      expect((await Account.findOne({ id: 2 }).select('+password')).password).toBe('emppw');
    });

    it('returns 404 for an unknown employee', async () => {
      const res = mockRes();
      await employeeController.resetPassword({ params: { id: 999 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('hashes a new password onto the account without returning it', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'oldhash', role: 3, status: 1 });
      await Employee.create({ id: 1, user_id: 1, branch_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      const res = mockRes();
      await employeeController.resetPassword({ params: { id: 1 } }, res);
      const account = await Account.findOne({ id: 1 }).select('+password');
      expect(account.password).not.toBe('oldhash');
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.password).toBeUndefined();
      expect(responseBody.tempPassword).toBeUndefined();
    });
  });
});
