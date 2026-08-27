const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const supportTicketRoutes = require('./supportTicket.routes');
const Branch = require('../models/Branch');
const Account = require('../models/Account');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const SupportTicket = require('../models/SupportTicket');

const app = buildTestApp('/api/support-tickets', supportTicketRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER_A = 42;
const OWNER_B = 99;
const CUSTOMER_ID = 10;

async function positionId(code) {
  const position = await Position.findOne({ code });
  return position.id;
}

async function seedBranchesAndStaff() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
  await Account.create({ id: CUSTOMER_ID, email: 'customer@example.com', password: 'hashed', name: 'Customer', role: 1 });
  await Employee.create([
    {
      id: 1,
      user_id: 7,
      branch_id: 1,
      employee_code: 'EMP-000001',
      position_id: await positionId('CUSTOMER_SERVICE'),
      status: 1,
    },
    {
      id: 2,
      user_id: 8,
      branch_id: 2,
      employee_code: 'EMP-000002',
      position_id: await positionId('CUSTOMER_SERVICE'),
      status: 1,
    },
  ]);
}

describe('supportTicket.routes wiring', () => {
  describe('POST /api/support-tickets', () => {
    it('requires auth', async () => {
      const res = await request(app).post('/api/support-tickets').send({});
      expect(res.status).toBe(401);
    });

    it('is forbidden for a customer (no supportTicket.create permission)', async () => {
      await seedBranchesAndStaff();
      const res = await request(app)
        .post('/api/support-tickets')
        .set('Authorization', authHeader({ role: 1, accountId: 1 }))
        .send({ branch_id: 1, customer_id: CUSTOMER_ID, subject: 'Help' });
      expect(res.status).toBe(403);
    });

    it('forbids a Customer Service employee staffed at a different branch', async () => {
      await seedBranchesAndStaff();
      const res = await request(app)
        .post('/api/support-tickets')
        .set('Authorization', authHeader({ role: 3, accountId: 8 }))
        .send({ branch_id: 1, customer_id: CUSTOMER_ID, subject: 'Help' });
      expect(res.status).toBe(403);
    });

    it('allows a Customer Service employee to open a ticket for their own branch', async () => {
      await seedBranchesAndStaff();
      const res = await request(app)
        .post('/api/support-tickets')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }))
        .send({ branch_id: 1, customer_id: CUSTOMER_ID, subject: 'Cannot check in', category: 'COMPLAINT' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.category).toBe('COMPLAINT');
    });

    it('allows the owning branch admin to open a ticket', async () => {
      await seedBranchesAndStaff();
      const res = await request(app)
        .post('/api/support-tickets')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
        .send({ branch_id: 1, customer_id: CUSTOMER_ID, subject: 'Refund question' });
      expect(res.status).toBe(201);
    });
  });

  describe('claim / assign / resolve / close lifecycle', () => {
    async function seedOpenTicket() {
      await seedBranchesAndStaff();
      await SupportTicket.create({ id: 1, customer_id: CUSTOMER_ID, branch_id: 1, subject: 'Help', created_by: OWNER_A });
    }

    it('lets a Customer Service employee claim an OPEN ticket themselves', async () => {
      await seedOpenTicket();
      const res = await request(app)
        .post('/api/support-tickets/1/claim')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.assigned_employee_id).toBe(1);
    });

    it('is forbidden for a plain employee to assign (Branch Admin only)', async () => {
      await seedOpenTicket();
      const res = await request(app)
        .post('/api/support-tickets/1/assign')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }))
        .send({ employee_id: 1 });
      expect(res.status).toBe(403);
    });

    it('forbids a branch admin who does not own the branch', async () => {
      await seedOpenTicket();
      const res = await request(app)
        .post('/api/support-tickets/1/assign')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }))
        .send({ employee_id: 1 });
      expect(res.status).toBe(403);
    });

    it('runs the full assign -> resolve -> close flow', async () => {
      await seedOpenTicket();

      const assignRes = await request(app)
        .post('/api/support-tickets/1/assign')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
        .send({ employee_id: 1 });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.status).toBe('IN_PROGRESS');

      const resolveRes = await request(app)
        .post('/api/support-tickets/1/resolve')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }))
        .send({ resolution_note: 'Helped the customer rebook' });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.status).toBe('RESOLVED');

      // Closing is Branch Admin-only — a Customer Service employee cannot close it themselves.
      const forbiddenClose = await request(app)
        .post('/api/support-tickets/1/close')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(forbiddenClose.status).toBe(403);

      const closeRes = await request(app)
        .post('/api/support-tickets/1/close')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.status).toBe('CLOSED');
    });
  });

  describe('GET /api/support-tickets', () => {
    it('requires branchId for a BRANCH-scoped caller', async () => {
      await seedBranchesAndStaff();
      const res = await request(app)
        .get('/api/support-tickets')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(res.status).toBe(400);
    });

    it("only returns the caller's own branch tickets", async () => {
      await seedBranchesAndStaff();
      await SupportTicket.create([
        { id: 1, customer_id: CUSTOMER_ID, branch_id: 1, subject: 'A', created_by: OWNER_A },
        { id: 2, customer_id: CUSTOMER_ID, branch_id: 2, subject: 'B', created_by: OWNER_B },
      ]);
      const res = await request(app)
        .get('/api/support-tickets')
        .query({ branchId: 1 })
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].id).toBe(1);
    });
  });

  describe('DELETE /api/support-tickets/:id', () => {
    it('allows the owning branch admin to delete an OPEN ticket', async () => {
      await seedBranchesAndStaff();
      await SupportTicket.create({ id: 1, customer_id: CUSTOMER_ID, branch_id: 1, subject: 'A', created_by: OWNER_A });
      const res = await request(app)
        .delete('/api/support-tickets/1')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(res.status).toBe(200);
    });

    it('is forbidden for a Customer Service employee (Branch Admin only)', async () => {
      await seedBranchesAndStaff();
      await SupportTicket.create({ id: 1, customer_id: CUSTOMER_ID, branch_id: 1, subject: 'A', created_by: OWNER_A });
      const res = await request(app)
        .delete('/api/support-tickets/1')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(res.status).toBe(403);
    });
  });
});
