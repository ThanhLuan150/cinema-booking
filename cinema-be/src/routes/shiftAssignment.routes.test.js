const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const shiftAssignmentRoutes = require('./shiftAssignment.routes');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const ShiftAssignment = require('../models/ShiftAssignment');
const Position = require('../models/Position');

const app = buildTestApp('/api/shiftAssignment', shiftAssignmentRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function ticketStaffId() {
  const position = await Position.findOne({ code: 'TICKET_STAFF' });
  return position.id;
}

async function seedBranchesWithStaff() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 99, name: 'Branch B', code: 'B' },
  ]);
  await Shift.create([
    { id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' },
    { id: 2, branch_id: 2, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' },
  ]);
  await Employee.create({
    id: 1,
    user_id: 7,
    branch_id: 1,
    employee_code: 'EMP-000001',
    position_id: await ticketStaffId(),
    status: 1,
  });
}

const assignmentPayload = (overrides = {}) => ({
  employee_id: 1,
  shift_id: 1,
  date: '2026-01-10',
  ...overrides,
});

describe('shiftAssignment.routes wiring', () => {
  describe('GET /api/shiftAssignment/me', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/shiftAssignment/me');
      expect(res.status).toBe(401);
    });

    it("returns the employee's own schedule", async () => {
      await seedBranchesWithStaff();
      await ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 1,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
      });
      const res = await request(app)
        .get('/api/shiftAssignment/me')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('is forbidden for a customer (no shiftAssignment.read permission)', async () => {
      const res = await request(app)
        .get('/api/shiftAssignment/me')
        .set('Authorization', authHeader({ role: 1, accountId: 1 }));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/shiftAssignment', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/shiftAssignment').query({ branchId: 1 });
      expect(res.status).toBe(401);
    });

    it('forbids a branch admin who does not own the branch', async () => {
      await seedBranchesWithStaff();
      const res = await request(app)
        .get('/api/shiftAssignment')
        .query({ branchId: 1 })
        .set('Authorization', authHeader({ role: 2, accountId: 99 }));
      expect(res.status).toBe(403);
    });

    it('allows the owning branch admin', async () => {
      await seedBranchesWithStaff();
      await ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 1,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
      });
      const res = await request(app)
        .get('/api/shiftAssignment')
        .query({ branchId: 1 })
        .set('Authorization', authHeader({ role: 2, accountId: 42 }));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('is forbidden for an employee merely staffed at the branch (management view is owner-only)', async () => {
      await seedBranchesWithStaff();
      const res = await request(app)
        .get('/api/shiftAssignment')
        .query({ branchId: 1 })
        .set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/shiftAssignment', () => {
    it('forbids a branch admin who does not own the employee\'s branch', async () => {
      await seedBranchesWithStaff();
      const res = await request(app)
        .post('/api/shiftAssignment')
        .set('Authorization', authHeader({ role: 2, accountId: 99 }))
        .send(assignmentPayload());
      expect(res.status).toBe(403);
    });

    it('allows the owning branch admin and creates the assignment', async () => {
      await seedBranchesWithStaff();
      const res = await request(app)
        .post('/api/shiftAssignment')
        .set('Authorization', authHeader({ role: 2, accountId: 42 }))
        .send(assignmentPayload());
      expect(res.status).toBe(201);
      expect(res.body.branch_id).toBe(1);
    });

    it('rejects a cross-branch assignment even from the employee\'s own owning admin', async () => {
      await seedBranchesWithStaff();
      const res = await request(app)
        .post('/api/shiftAssignment')
        .set('Authorization', authHeader({ role: 2, accountId: 42 }))
        .send(assignmentPayload({ shift_id: 2 }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BRANCH_MISMATCH');
    });

    it('is forbidden for a customer', async () => {
      await seedBranchesWithStaff();
      const res = await request(app)
        .post('/api/shiftAssignment')
        .set('Authorization', authHeader({ role: 1, accountId: 1 }))
        .send(assignmentPayload());
      expect(res.status).toBe(403);
    });

    it('is forbidden for an employee (no shiftAssignment.create permission)', async () => {
      await seedBranchesWithStaff();
      const res = await request(app)
        .post('/api/shiftAssignment')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }))
        .send(assignmentPayload());
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/shiftAssignment/:id', () => {
    it('forbids a branch admin from another branch', async () => {
      await seedBranchesWithStaff();
      await ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 1,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
      });
      const res = await request(app)
        .put('/api/shiftAssignment/1')
        .set('Authorization', authHeader({ role: 2, accountId: 99 }))
        .send({ status: 'CANCELLED' });
      expect(res.status).toBe(403);
    });

    it('allows the owning branch admin', async () => {
      await seedBranchesWithStaff();
      await ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 1,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
      });
      const res = await request(app)
        .put('/api/shiftAssignment/1')
        .set('Authorization', authHeader({ role: 2, accountId: 42 }))
        .send({ status: 'CANCELLED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });
  });

  describe('DELETE /api/shiftAssignment/:id', () => {
    it('forbids a branch admin from another branch', async () => {
      await seedBranchesWithStaff();
      await ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 1,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
      });
      const res = await request(app)
        .delete('/api/shiftAssignment/1')
        .set('Authorization', authHeader({ role: 2, accountId: 99 }));
      expect(res.status).toBe(403);
    });

    it('allows the owning branch admin', async () => {
      await seedBranchesWithStaff();
      await ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 1,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
      });
      const res = await request(app)
        .delete('/api/shiftAssignment/1')
        .set('Authorization', authHeader({ role: 2, accountId: 42 }));
      expect(res.status).toBe(200);
    });
  });
});
