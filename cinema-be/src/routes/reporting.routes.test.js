const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const reportingRoutes = require('./reporting.routes');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

const app = buildTestApp('/api/reports', reportingRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('reporting.routes wiring — /reports/financial', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/reports/financial');
    expect(res.status).toBe(401);
  });

  it('rejects a customer (no report.viewFinancial)', async () => {
    const res = await request(app).get('/api/reports/financial').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('rejects a plain employee (report.viewFinancial is not a default Employee permission)', async () => {
    const res = await request(app).get('/api/reports/financial').set('Authorization', authHeader({ role: 3, accountId: 55 }));
    expect(res.status).toBe(403);
  });

  it('allows a super admin', async () => {
    const res = await request(app).get('/api/reports/financial').set('Authorization', authHeader({ role: 0 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scope: 'ALL' });
  });

  it('allows a branch admin and scopes the report to their branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'M' });
    const res = await request(app).get('/api/reports/financial').set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scope: 'BRANCH', branchIds: [1] });
  });
});

describe('reporting.routes wiring — /reports/operational', () => {
  it('allows an employee staffed at a branch, with metrics narrowed to their Position', async () => {
    const checker = await Position.findOne({ code: 'TICKET_CHECKER' });
    await Employee.create({ id: 1, user_id: 55, branch_id: 3, employee_code: 'E1', position_id: checker.id, status: 1 });
    const res = await request(app).get('/api/reports/operational').set('Authorization', authHeader({ role: 3, accountId: 55 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scope: 'BRANCH', branchIds: [3], positionCode: 'TICKET_CHECKER' });
    expect(res.body.metrics).toHaveProperty('ticketsCheckedInToday');
    expect(res.body.metrics).not.toHaveProperty('pendingComboOrders');
  });

  it('rejects a customer', async () => {
    const res = await request(app).get('/api/reports/operational').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });
});
