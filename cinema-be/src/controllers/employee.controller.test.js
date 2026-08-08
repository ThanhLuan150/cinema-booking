const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const employeeController = require('./employee.controller');
const Employee = require('../models/Employee');
const Account = require('../models/Account');

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

    it('rejects a duplicate email', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3 });
      const res = mockRes();
      await employeeController.create(
        { body: { email: 'a@b.com', password: 'pw' }, cinemaId: 1 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('creates an account (role 3) and an employee record', async () => {
      const res = mockRes();
      await employeeController.create(
        { body: { email: 'staff@cinema.com', password: 'pw', name: 'Staff One', position: 'Cashier' }, cinemaId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const account = await Account.findOne({ email: 'staff@cinema.com' });
      expect(account.role).toBe(3);
      expect(account.approved).toBe(true);
      const employee = await Employee.findOne({ account_id: account.id });
      expect(employee.cinema_id).toBe(5);
      expect(employee.position).toBe('Cashier');
    });
  });

  describe('list', () => {
    it('returns employees scoped to req.cinemaId enriched with account info', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3, name: 'A' });
      await Employee.create({ id: 1, account_id: 1, cinema_id: 5 });
      await Employee.create({ id: 2, account_id: 2, cinema_id: 9 });
      const res = mockRes();
      await employeeController.list({ query: {}, cinemaId: 5 }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.total).toBe(1);
      expect(payload.data[0].email).toBe('a@b.com');
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown employee', async () => {
      const res = mockRes();
      await employeeController.update({ params: { id: 999 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates position and status', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3 });
      await Employee.create({ id: 1, account_id: 1, cinema_id: 5 });
      const res = mockRes();
      await employeeController.update({ params: { id: 1 }, body: { position: 'Manager', status: 0 } }, res);
      const updated = await Employee.findOne({ id: 1 });
      expect(updated.position).toBe('Manager');
      expect(updated.status).toBe(0);
    });
  });

  describe('remove', () => {
    it('deactivates the employee and locks the account', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 3, status: 1 });
      await Employee.create({ id: 1, account_id: 1, cinema_id: 5, status: 1 });
      const res = mockRes();
      await employeeController.remove({ params: { id: 1 } }, res);
      expect(await Employee.findOne({ id: 1 })).toHaveProperty('status', 0);
      expect(await Account.findOne({ id: 1 })).toHaveProperty('status', 0);
    });
  });
});
