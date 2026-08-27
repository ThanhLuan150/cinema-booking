const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const auditLogRoutes = require('./auditLog.routes');
const auditLogRepository = require('../repositories/auditLog.repository');
const Branch = require('../models/Branch');

const app = buildTestApp('/api/audit-logs', auditLogRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const SUPER_ADMIN = { role: 0, accountId: 1 };
const OWNER_A = 42;
const OWNER_B = 99;

async function seedBranchesAndTrail() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
  await auditLogRepository.create({ entityType: 'BRANCH', entityId: 1, action: 'CREATE_BRANCH', performedBy: 1, branchId: 1 });
  await auditLogRepository.create({ entityType: 'EMPLOYEE', entityId: 5, action: 'CREATE_EMPLOYEE', performedBy: OWNER_B, branchId: 2 });
  await auditLogRepository.create({ entityType: 'MOVIE', entityId: 9, action: 'CREATE_MOVIE', performedBy: 1, branchId: null });
}

describe('auditLog.routes', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(401);
  });

  it('is forbidden for a plain employee (no auditLog.read)', async () => {
    const res = await request(app).get('/api/audit-logs').set('Authorization', authHeader({ role: 3, accountId: 7 }));
    expect(res.status).toBe(403);
  });

  it('is forbidden for a customer', async () => {
    const res = await request(app).get('/api/audit-logs').set('Authorization', authHeader({ role: 1, accountId: 7 }));
    expect(res.status).toBe(403);
  });

  it('lets a SUPER_ADMIN read the whole system trail', async () => {
    await seedBranchesAndTrail();
    const res = await request(app).get('/api/audit-logs').set('Authorization', authHeader(SUPER_ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    // spec field list: user_id / action / entity_type / entity_id / branch_id / metadata / created_at
    const sample = res.body.data[0];
    expect(sample).toHaveProperty('user_id');
    expect(sample).toHaveProperty('entity_type');
    expect(sample).toHaveProperty('branch_id');
    expect(sample).toHaveProperty('createdAt');
  });

  it('scopes a BRANCH_ADMIN to their own branch', async () => {
    await seedBranchesAndTrail();
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].branch_id).toBe(2);
  });

  it("forbids a BRANCH_ADMIN from passing another branch's ?branchId", async () => {
    await seedBranchesAndTrail();
    const res = await request(app)
      .get('/api/audit-logs?branchId=1')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }));
    expect(res.status).toBe(403);
  });

  it('GET /meta returns the vocabulary for filter dropdowns', async () => {
    const res = await request(app).get('/api/audit-logs/meta').set('Authorization', authHeader(SUPER_ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.actions).toEqual(expect.arrayContaining(['CREATE_MOVIE', 'CANCEL_BOOKING']));
  });

  it('exposes no write endpoints (append-only)', async () => {
    const auth = authHeader(SUPER_ADMIN);
    expect((await request(app).post('/api/audit-logs').set('Authorization', auth).send({})).status).toBe(404);
    expect((await request(app).put('/api/audit-logs/1').set('Authorization', auth).send({})).status).toBe(404);
    expect((await request(app).delete('/api/audit-logs/1').set('Authorization', auth)).status).toBe(404);
  });
});
