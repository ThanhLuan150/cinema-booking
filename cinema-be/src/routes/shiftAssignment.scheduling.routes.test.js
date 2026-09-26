// Ticket 44 — role/scope wiring for shift scheduling: Super Admin sees the whole system, a Branch
// Admin only their own branch, an Employee only their own shifts, and overlaps are refused.
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

const SUPER_ADMIN = { role: 0, accountId: 1 };
const ADMIN_A = { role: 2, accountId: 42 }; // owns branch 1
const ADMIN_B = { role: 2, accountId: 99 }; // owns branch 2
const EMPLOYEE_A = { role: 3, accountId: 7 }; // employee 1, branch 1
const EMPLOYEE_A2 = { role: 3, accountId: 8 }; // employee 2, branch 1

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
  const cashier = await Position.findOne({ code: 'CASHIER' });
  const ticketStaff = await Position.findOne({ code: 'TICKET_STAFF' });
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 99, name: 'Branch B', code: 'B' },
  ]);
  await Shift.create([
    { id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00' },
    { id: 2, branch_id: 1, name: 'Afternoon', start_time: '14:00', end_time: '22:00' },
    { id: 3, branch_id: 2, name: 'Morning', start_time: '08:00', end_time: '16:00' },
  ]);
  await Employee.create([
    { id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: ticketStaff.id, status: 1 },
    { id: 2, user_id: 8, branch_id: 1, employee_code: 'EMP-000002', position_id: cashier.id, status: 1 },
    { id: 3, user_id: 9, branch_id: 2, employee_code: 'EMP-000003', position_id: cashier.id, status: 1 },
  ]);
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const at = (iso) => new Date(iso);
const assignment = (overrides) => ({
  id: 1,
  employee_id: 1,
  shift_id: 1,
  branch_id: 1,
  date: '2026-01-10',
  start_at: at('2026-01-10T08:00:00'),
  end_at: at('2026-01-10T16:00:00'),
  ...overrides,
});

describe('GET /api/shiftAssignment scope', () => {
  beforeEach(async () => {
    await ShiftAssignment.create([
      assignment({ id: 1 }),
      assignment({ id: 2, employee_id: 2 }),
      assignment({ id: 3, employee_id: 3, shift_id: 3, branch_id: 2 }),
    ]);
  });

  it('lets a Super Admin list the whole system without naming a branch', async () => {
    const res = await request(app).get('/api/shiftAssignment').set('Authorization', authHeader(SUPER_ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });

  it('lets a Super Admin narrow to one branch', async () => {
    const res = await request(app)
      .get('/api/shiftAssignment')
      .query({ branchId: 2 })
      .set('Authorization', authHeader(SUPER_ADMIN));
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].branch_id).toBe(2);
  });

  it('requires a branch Admin to name a branch (no implicit all-branches view)', async () => {
    const res = await request(app).get('/api/shiftAssignment').set('Authorization', authHeader(ADMIN_A));
    expect(res.status).toBe(404);
  });

  it('confines a Branch Admin to their own branch', async () => {
    const own = await request(app)
      .get('/api/shiftAssignment')
      .query({ branchId: 1 })
      .set('Authorization', authHeader(ADMIN_A));
    expect(own.body.total).toBe(2);

    const other = await request(app)
      .get('/api/shiftAssignment')
      .query({ branchId: 2 })
      .set('Authorization', authHeader(ADMIN_A));
    expect(other.status).toBe(403);
  });
});

describe('GET /api/shiftAssignment/me', () => {
  it('shows an Employee only their own shifts, with the Position they work them as', async () => {
    const cashier = await Position.findOne({ code: 'CASHIER' });
    await ShiftAssignment.create([
      assignment({ id: 1, employee_id: 1, position_id: cashier.id }),
      assignment({ id: 2, employee_id: 2 }),
    ]);
    const res = await request(app).get('/api/shiftAssignment/me').set('Authorization', authHeader(EMPLOYEE_A));
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe(1);
    expect(res.body.data[0].position).toEqual({ code: 'CASHIER', name: expect.any(String) });

    const other = await request(app).get('/api/shiftAssignment/me').set('Authorization', authHeader(EMPLOYEE_A2));
    expect(other.body.data.map((a) => a.id)).toEqual([2]);
  });
});

describe('POST /api/shiftAssignment conflicts', () => {
  const post = (actor, body) =>
    request(app).post('/api/shiftAssignment').set('Authorization', authHeader(actor)).send(body);

  it('refuses a second, overlapping shift for the same employee with 409 SHIFT_OVERLAP', async () => {
    const first = await post(ADMIN_A, { employee_id: 1, shift_id: 1, date: '2026-01-10' });
    expect(first.status).toBe(201);
    const second = await post(ADMIN_A, { employee_id: 1, shift_id: 2, date: '2026-01-10' });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('SHIFT_OVERLAP');
    expect(await ShiftAssignment.countDocuments()).toBe(1);
  });

  it('stores the chosen Position and rejects an invalid one', async () => {
    const cashier = await Position.findOne({ code: 'CASHIER' });
    const ok = await post(ADMIN_A, { employee_id: 1, shift_id: 1, date: '2026-01-10', position_id: cashier.id });
    expect(ok.status).toBe(201);
    expect(ok.body.position_id).toBe(cashier.id);

    const bad = await post(ADMIN_A, { employee_id: 1, shift_id: 2, date: '2026-01-11', position_id: 99999 });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_POSITION');
  });

  it('refuses an inactive employee', async () => {
    await Employee.updateOne({ id: 1 }, { status: 0 });
    const res = await post(ADMIN_A, { employee_id: 1, shift_id: 1, date: '2026-01-10' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMPLOYEE_NOT_ACTIVE');
  });

  it('stops a Branch Admin scheduling another branch\'s employee', async () => {
    const res = await post(ADMIN_B, { employee_id: 1, shift_id: 1, date: '2026-01-10' });
    expect(res.status).toBe(403);
  });

  it('lets a Super Admin schedule an employee in any branch', async () => {
    const res = await post(SUPER_ADMIN, { employee_id: 3, shift_id: 3, date: '2026-01-10' });
    expect(res.status).toBe(201);
    expect(res.body.branch_id).toBe(2);
  });
});

describe('PUT /api/shiftAssignment/:id conflicts', () => {
  it('blocks reactivating a cancelled shift that now collides, and the admin gets a 409', async () => {
    await ShiftAssignment.create([
      assignment({ id: 1 }),
      assignment({ id: 2, shift_id: 2, status: 'CANCELLED', start_at: at('2026-01-10T14:00:00'), end_at: at('2026-01-10T22:00:00') }),
    ]);
    const res = await request(app)
      .put('/api/shiftAssignment/2')
      .set('Authorization', authHeader(ADMIN_A))
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SHIFT_OVERLAP');
  });
});
