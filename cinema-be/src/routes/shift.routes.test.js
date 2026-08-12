const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const shiftRoutes = require('./shift.routes');
const Branch = require('../models/Branch');
const Shift = require('../models/Shift');

const app = buildTestApp('/api/shift', shiftRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedBranches() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 99, name: 'Branch B', code: 'B' },
  ]);
}

const shiftPayload = (overrides = {}) => ({
  branch_id: 1,
  name: 'Ca sáng',
  start_time: '08:00',
  end_time: '16:00',
  ...overrides,
});

describe('shift.routes wiring', () => {
  it('GET /api/shift requires auth', async () => {
    const res = await request(app).get('/api/shift').query({ branchId: 1 });
    expect(res.status).toBe(401);
  });

  it('GET /api/shift forbids a branch admin who does not own the branch', async () => {
    await seedBranches();
    const res = await request(app)
      .get('/api/shift')
      .query({ branchId: 1 })
      .set('Authorization', authHeader({ role: 2, accountId: 99 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/shift allows the owning branch admin', async () => {
    await seedBranches();
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    const res = await request(app)
      .get('/api/shift')
      .query({ branchId: 1 })
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('GET /api/shift allows super admin regardless of ownership', async () => {
    await seedBranches();
    const res = await request(app)
      .get('/api/shift')
      .query({ branchId: 2 })
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
  });

  it('POST /api/shift forbids a branch admin who does not own the branch', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/shift')
      .set('Authorization', authHeader({ role: 2, accountId: 99 }))
      .send(shiftPayload({ branch_id: 1 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/shift allows the owning branch admin', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/shift')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send(shiftPayload({ branch_id: 1 }));
    expect(res.status).toBe(201);
    expect(res.body.branch_id).toBe(1);
  });

  it('POST /api/shift is forbidden for a customer', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/shift')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }))
      .send(shiftPayload({ branch_id: 1 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/shift is forbidden for an employee (no shift.create permission)', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/shift')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }))
      .send(shiftPayload({ branch_id: 1 }));
    expect(res.status).toBe(403);
  });

  it('PUT /api/shift/:id forbids a branch admin from another branch', async () => {
    await seedBranches();
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    const res = await request(app)
      .put('/api/shift/1')
      .set('Authorization', authHeader({ role: 2, accountId: 99 }))
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/shift/:id allows the owning branch admin', async () => {
    await seedBranches();
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    const res = await request(app)
      .put('/api/shift/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('DELETE /api/shift/:id forbids a branch admin from another branch', async () => {
    await seedBranches();
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    const res = await request(app)
      .delete('/api/shift/1')
      .set('Authorization', authHeader({ role: 2, accountId: 99 }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/shift/:id allows the owning branch admin', async () => {
    await seedBranches();
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    const res = await request(app)
      .delete('/api/shift/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
  });
});
