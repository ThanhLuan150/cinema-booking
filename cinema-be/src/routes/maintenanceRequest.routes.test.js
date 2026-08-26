const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const maintenanceRequestRoutes = require('./maintenanceRequest.routes');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const MaintenanceRequest = require('../models/MaintenanceRequest');

const app = buildTestApp('/api/maintenance', maintenanceRequestRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER_A = 42;
const OWNER_B = 99;

async function positionId(code) {
  const position = await Position.findOne({ code });
  return position.id;
}

async function seedBranchesRoomsAndStaff() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
  await Room.create([
    { id: 1, cinema_id: 1, name: 'Room 1', code: 'R1', status: 'ACTIVE' },
    { id: 2, cinema_id: 2, name: 'Room 2', code: 'R2', status: 'ACTIVE' },
  ]);
  await Employee.create([
    {
      id: 1,
      user_id: 7,
      branch_id: 1,
      employee_code: 'EMP-000001',
      position_id: await positionId('MAINTENANCE_STAFF'),
      status: 1,
    },
    {
      id: 2,
      user_id: 8,
      branch_id: 2,
      employee_code: 'EMP-000002',
      position_id: await positionId('MAINTENANCE_STAFF'),
      status: 1,
    },
  ]);
}

describe('maintenanceRequest.routes wiring', () => {
  describe('POST /api/maintenance', () => {
    it('requires auth', async () => {
      const res = await request(app).post('/api/maintenance').send({});
      expect(res.status).toBe(401);
    });

    it('is forbidden for a customer (no maintenance.create permission)', async () => {
      await seedBranchesRoomsAndStaff();
      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', authHeader({ role: 1, accountId: 1 }))
        .send({ branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Flicker' });
      expect(res.status).toBe(403);
    });

    it('forbids an employee staffed at a different branch', async () => {
      await seedBranchesRoomsAndStaff();
      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', authHeader({ role: 3, accountId: 8 }))
        .send({ branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Flicker' });
      expect(res.status).toBe(403);
    });

    it('allows an employee staffed at the branch to report an issue and puts the Room under MAINTENANCE', async () => {
      await seedBranchesRoomsAndStaff();
      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }))
        .send({ branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Flicker' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OPEN');
      expect((await Room.findOne({ id: 1 })).status).toBe('MAINTENANCE');
    });

    it('allows the owning branch admin to report an issue for a non-room resource', async () => {
      await seedBranchesRoomsAndStaff();
      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
        .send({ branch_id: 1, resource_type: 'POS', resource_name: 'Counter 1', title: 'POS frozen' });
      expect(res.status).toBe(201);
      expect(res.body.resource_name).toBe('Counter 1');
    });
  });

  describe('assign / start / resolve / close lifecycle', () => {
    async function seedOpenRoomRequest() {
      await seedBranchesRoomsAndStaff();
      await MaintenanceRequest.create({
        id: 1,
        branch_id: 1,
        resource_type: 'ROOM',
        room_id: 1,
        title: 'Flicker',
        reported_by: 7,
      });
      await Room.updateOne({ id: 1 }, { $set: { status: 'MAINTENANCE' } });
    }

    it('is forbidden for a customer to assign', async () => {
      await seedOpenRoomRequest();
      const res = await request(app)
        .post('/api/maintenance/1/assign')
        .set('Authorization', authHeader({ role: 1, accountId: 1 }))
        .send({ employee_id: 1 });
      expect(res.status).toBe(403);
    });

    it('is forbidden for a plain employee to assign (Branch Admin only)', async () => {
      await seedOpenRoomRequest();
      const res = await request(app)
        .post('/api/maintenance/1/assign')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }))
        .send({ employee_id: 1 });
      expect(res.status).toBe(403);
    });

    it('forbids a branch admin who does not own the branch', async () => {
      await seedOpenRoomRequest();
      const res = await request(app)
        .post('/api/maintenance/1/assign')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }))
        .send({ employee_id: 1 });
      expect(res.status).toBe(403);
    });

    it('runs the full assign -> start -> resolve -> close flow and restores the Room', async () => {
      await seedOpenRoomRequest();

      const assignRes = await request(app)
        .post('/api/maintenance/1/assign')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
        .send({ employee_id: 1 });
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.status).toBe('ASSIGNED');

      // The assigned MAINTENANCE_STAFF employee starts the work.
      const startRes = await request(app)
        .post('/api/maintenance/1/start')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(startRes.status).toBe(200);
      expect(startRes.body.status).toBe('IN_PROGRESS');

      const resolveRes = await request(app)
        .post('/api/maintenance/1/resolve')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }))
        .send({ resolution_note: 'Replaced the bulb' });
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.status).toBe('RESOLVED');
      expect((await Room.findOne({ id: 1 })).status).toBe('ACTIVE');

      // Closing is Branch Admin-only.
      const forbiddenClose = await request(app)
        .post('/api/maintenance/1/close')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(forbiddenClose.status).toBe(403);

      const closeRes = await request(app)
        .post('/api/maintenance/1/close')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.status).toBe('CLOSED');
    });

    it('a plain (non maintenance-staff) employee cannot start/resolve a ticket', async () => {
      await seedBranchesRoomsAndStaff();
      await Employee.create({
        id: 3,
        user_id: 9,
        branch_id: 1,
        employee_code: 'EMP-000003',
        position_id: await positionId('TICKET_STAFF'),
        status: 1,
      });
      await MaintenanceRequest.create({
        id: 1,
        branch_id: 1,
        resource_type: 'ROOM',
        room_id: 1,
        title: 'Flicker',
        status: 'ASSIGNED',
        assigned_employee_id: 3,
        reported_by: 7,
      });

      const res = await request(app)
        .post('/api/maintenance/1/start')
        .set('Authorization', authHeader({ role: 3, accountId: 9 }));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/maintenance', () => {
    it('requires branchId for a BRANCH-scoped caller', async () => {
      await seedBranchesRoomsAndStaff();
      const res = await request(app)
        .get('/api/maintenance')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(res.status).toBe(400);
    });

    it("only returns the caller's own branch requests", async () => {
      await seedBranchesRoomsAndStaff();
      await MaintenanceRequest.create([
        { id: 1, branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'A', reported_by: 7 },
        { id: 2, branch_id: 2, resource_type: 'ROOM', room_id: 2, title: 'B', reported_by: 8 },
      ]);
      const res = await request(app)
        .get('/api/maintenance')
        .query({ branchId: 1 })
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].id).toBe(1);
    });
  });

  describe('GET /api/maintenance/:id', () => {
    it('forbids a branch admin from reading another branch\'s request by id', async () => {
      await seedBranchesRoomsAndStaff();
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'A', reported_by: 7 });
      const res = await request(app)
        .get('/api/maintenance/1')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }));
      expect(res.status).toBe(403);
    });

    it('forbids an employee staffed at another branch from reading it by id', async () => {
      await seedBranchesRoomsAndStaff();
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'A', reported_by: 7 });
      const res = await request(app)
        .get('/api/maintenance/1')
        .set('Authorization', authHeader({ role: 3, accountId: 8 }));
      expect(res.status).toBe(403);
    });

    it("allows the owning branch admin and an employee staffed there", async () => {
      await seedBranchesRoomsAndStaff();
      await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'A', reported_by: 7 });
      const ownerRes = await request(app)
        .get('/api/maintenance/1')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(ownerRes.status).toBe(200);
      const employeeRes = await request(app)
        .get('/api/maintenance/1')
        .set('Authorization', authHeader({ role: 3, accountId: 7 }));
      expect(employeeRes.status).toBe(200);
    });
  });

  describe('DELETE /api/maintenance/:id', () => {
    it('allows the owning branch admin to delete an OPEN request', async () => {
      await seedOpenRoomRequestHelper();
      const res = await request(app)
        .delete('/api/maintenance/1')
        .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
      expect(res.status).toBe(200);
    });

    async function seedOpenRoomRequestHelper() {
      await seedBranchesRoomsAndStaff();
      await MaintenanceRequest.create({
        id: 1,
        branch_id: 1,
        resource_type: 'ROOM',
        room_id: 1,
        title: 'Flicker',
        reported_by: 7,
      });
    }
  });
});
