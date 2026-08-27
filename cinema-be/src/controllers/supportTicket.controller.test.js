const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const supportTicketController = require('./supportTicket.controller');
const SupportTicket = require('../models/SupportTicket');
const Account = require('../models/Account');
const Employee = require('../models/Employee');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const staff = { accountId: 7, email: 'cs@example.com', role: 3 };

async function seedCustomer(overrides = {}) {
  return Account.create({ id: 10, email: 'customer@example.com', password: 'hashed', name: 'Customer', role: 1, ...overrides });
}

describe('supportTicket.controller', () => {
  describe('create', () => {
    it('rejects missing customer_id/subject', async () => {
      const res = mockRes();
      await supportTicketController.create({ body: {}, branchId: 1, account: staff }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects an invalid category', async () => {
      await seedCustomer();
      const res = mockRes();
      await supportTicketController.create(
        { body: { customer_id: 10, subject: 'Help', category: 'NOT_REAL' }, branchId: 1, account: staff },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_CATEGORY' }));
    });

    it('404s for an unknown customer', async () => {
      const res = mockRes();
      await supportTicketController.create({ body: { customer_id: 999, subject: 'Help' }, branchId: 1, account: staff }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('creates an OPEN ticket defaulting to GENERAL category', async () => {
      await seedCustomer();
      const res = mockRes();
      await supportTicketController.create({ body: { customer_id: 10, subject: 'Cannot check in' }, branchId: 1, account: staff }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      const ticket = await SupportTicket.findOne({ customer_id: 10 });
      expect(ticket.status).toBe('OPEN');
      expect(ticket.category).toBe('GENERAL');
      expect(ticket.created_by).toBe(7);
    });

    it('creates a COMPLAINT ticket', async () => {
      await seedCustomer();
      const res = mockRes();
      await supportTicketController.create(
        { body: { customer_id: 10, subject: 'Rude staff', category: 'COMPLAINT' }, branchId: 1, account: staff },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ category: 'COMPLAINT' }));
    });
  });

  describe('update', () => {
    it('404s for an unknown ticket', async () => {
      const res = mockRes();
      await supportTicketController.update({ params: { id: 999 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects editing a CLOSED ticket', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', status: 'CLOSED', created_by: 7 });
      const res = mockRes();
      await supportTicketController.update({ params: { id: 1 }, body: { subject: 'Y' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUPPORT_TICKET_CLOSED' }));
    });

    it('updates the subject', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', created_by: 7 });
      const res = mockRes();
      await supportTicketController.update({ params: { id: 1 }, body: { subject: 'Y' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Y' }));
    });
  });

  describe('claim', () => {
    it('requires the caller to be a staffed employee', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', created_by: 7 });
      const res = mockRes();
      await supportTicketController.claim({ params: { id: 1 }, employee: undefined }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_AN_EMPLOYEE' }));
    });

    it('claims an OPEN ticket for the caller', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', created_by: 7 });
      const res = mockRes();
      await supportTicketController.claim({ params: { id: 1 }, employee: { id: 5 } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS', assigned_employee_id: 5 }));
    });

    it('rejects claiming an already IN_PROGRESS ticket', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', status: 'IN_PROGRESS', created_by: 7 });
      const res = mockRes();
      await supportTicketController.claim({ params: { id: 1 }, employee: { id: 5 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUPPORT_TICKET_NOT_CLAIMABLE' }));
    });
  });

  describe('assign', () => {
    async function seedTicketAndEmployee({ employeeBranchId = 1, employeeStatus = 1 } = {}) {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', created_by: 7 });
      await Employee.create({ id: 5, user_id: 20, branch_id: employeeBranchId, employee_code: 'EMP-000005', position_id: 1, status: employeeStatus });
    }

    it('requires employee_id', async () => {
      const res = mockRes();
      await supportTicketController.assign({ params: { id: 1 }, body: {}, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('404s for an unknown employee', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', created_by: 7 });
      const res = mockRes();
      await supportTicketController.assign({ params: { id: 1 }, body: { employee_id: 999 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects an inactive employee', async () => {
      await seedTicketAndEmployee({ employeeStatus: 0 });
      const res = mockRes();
      await supportTicketController.assign({ params: { id: 1 }, body: { employee_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMPLOYEE_NOT_ACTIVE' }));
    });

    it('rejects an employee from a different branch', async () => {
      await seedTicketAndEmployee({ employeeBranchId: 2 });
      const res = mockRes();
      await supportTicketController.assign({ params: { id: 1 }, body: { employee_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BRANCH_MISMATCH' }));
    });

    it('assigns the employee and moves to IN_PROGRESS', async () => {
      await seedTicketAndEmployee();
      const res = mockRes();
      await supportTicketController.assign({ params: { id: 1 }, body: { employee_id: 5 }, account: { accountId: 42 } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS', assigned_employee_id: 5 }));
    });
  });

  describe('resolve / close lifecycle', () => {
    it('rejects resolve when not IN_PROGRESS', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', created_by: 7 });
      const res = mockRes();
      await supportTicketController.resolve({ params: { id: 1 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUPPORT_TICKET_NOT_IN_PROGRESS' }));
    });

    it('rejects close when not RESOLVED', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', status: 'IN_PROGRESS', created_by: 7 });
      const res = mockRes();
      await supportTicketController.close({ params: { id: 1 }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUPPORT_TICKET_NOT_RESOLVED' }));
    });

    it('moves IN_PROGRESS -> RESOLVED -> CLOSED', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', status: 'IN_PROGRESS', created_by: 7 });

      const resolveRes = mockRes();
      await supportTicketController.resolve({ params: { id: 1 }, body: { resolution_note: 'Refunded manually' } }, resolveRes);
      expect(resolveRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'RESOLVED', resolution_note: 'Refunded manually' }));

      const closeRes = mockRes();
      await supportTicketController.close({ params: { id: 1 }, account: { accountId: 42 } }, closeRes);
      expect(closeRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'CLOSED' }));
    });
  });

  describe('remove', () => {
    it('rejects deleting a ticket that is no longer OPEN', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', status: 'IN_PROGRESS', created_by: 7 });
      const res = mockRes();
      await supportTicketController.remove({ params: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUPPORT_TICKET_NOT_DELETABLE' }));
    });

    it('deletes an OPEN ticket', async () => {
      await SupportTicket.create({ id: 1, customer_id: 10, branch_id: 1, subject: 'X', created_by: 7 });
      const res = mockRes();
      await supportTicketController.remove({ params: { id: 1 } }, res);
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted' });
      expect(await SupportTicket.findOne({ id: 1 })).toBeNull();
    });
  });

  describe('list / getById', () => {
    it('filters by branch and status', async () => {
      await SupportTicket.create([
        { id: 1, customer_id: 10, branch_id: 1, subject: 'A', status: 'OPEN', created_by: 7 },
        { id: 2, customer_id: 10, branch_id: 1, subject: 'B', status: 'CLOSED', created_by: 7 },
        { id: 3, customer_id: 10, branch_id: 2, subject: 'C', status: 'OPEN', created_by: 7 },
      ]);
      const res = mockRes();
      await supportTicketController.list({ branchId: 1, query: { status: 'OPEN' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
    });

    it('404s for an unknown ticket', async () => {
      const res = mockRes();
      await supportTicketController.getById({ params: { id: 999 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
