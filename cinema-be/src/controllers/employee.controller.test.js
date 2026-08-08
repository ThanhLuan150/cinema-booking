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
      await employeeController.create({ body: {}, cinemaId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a missing position_id', async () => {
      const res = mockRes();
      await employeeController.create({ body: { email: 'a@b.com', password: 'pw' }, cinemaId: 1 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a position_id that does not exist', async () => {
      const res = mockRes();
      await employeeController.create(
        { body: { email: 'a@b.com', password: 'pw', position_id: 999 }, cinemaId: 1 },
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
        { body: { email: 'a@b.com', password: 'pw', position_id: 1 }, cinemaId: 1 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('creates an account (role 3) and an employee record with a generated employee_code', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      const res = mockRes();
      await employeeController.create(
        { body: { email: 'staff@cinema.com', password: 'pw', name: 'Staff One', position_id: 1 }, cinemaId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const account = await Account.findOne({ email: 'staff@cinema.com' });
      expect(account.role).toBe(3);
      expect(account.approved).toBe(true);
      const employee = await Employee.findOne({ account_id: account.id });
      expect(employee.cinema_id).toBe(5);
      expect(employee.position_id).toBe(1);
      expect(employee.employee_code).toMatch(/^EMP-\d{6}$/);
    });

    it('ignores a role field in the body — every employee created here is role 3', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      const res = mockRes();
      await employeeController.create(
        {
          body: { email: 'staff2@cinema.com', password: 'pw', position_id: 1, role: 0 },
          cinemaId: 5,
        },
        res,
      );
      const account = await Account.findOne({ email: 'staff2@cinema.com' });
      expect(account.role).toBe(3);
    });
  });

  describe('list', () => {
    it('returns employees scoped to req.cinemaId enriched with account info and position', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3, name: 'A' });
      await Employee.create({ id: 1, account_id: 1, cinema_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      await Employee.create({ id: 2, account_id: 2, cinema_id: 9, employee_code: 'EMP-000002', position_id: 1 });
      const res = mockRes();
      await employeeController.list({ query: {}, cinemaId: 5 }, res);
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
      await Employee.create({ id: 1, account_id: 1, cinema_id: 5, employee_code: 'EMP-000001', position_id: 1 });
      const res = mockRes();
      await employeeController.update({ params: { id: 1 }, body: { position_id: 999 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('updates position_id and status', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Position.create({ id: 2, code: 'SHIFT_SUPERVISOR', name: 'Shift Supervisor', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3 });
      await Employee.create({ id: 1, account_id: 1, cinema_id: 5, employee_code: 'EMP-000001', position_id: 1 });
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
      await Employee.create({ id: 1, account_id: 1, cinema_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      const res = mockRes();
      await employeeController.remove({ params: { id: 1 } }, res);
      expect(await Employee.findOne({ id: 1 })).toHaveProperty('status', 0);
      expect(await Account.findOne({ id: 1 })).toHaveProperty('status', 0);
    });
  });

  describe('resetPassword', () => {
    it('returns 404 for an unknown employee', async () => {
      const res = mockRes();
      await employeeController.resetPassword({ params: { id: 999 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('hashes a new password onto the account without returning it', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      await Account.create({ id: 1, email: 'a@b.com', password: 'oldhash', role: 3, status: 1 });
      await Employee.create({ id: 1, account_id: 1, cinema_id: 5, employee_code: 'EMP-000001', position_id: 1 });
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
