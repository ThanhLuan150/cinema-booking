const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const entranceRoutes = require('./entrance.routes');
const Branch = require('../models/Branch');
const Entrance = require('../models/Entrance');

const app = buildTestApp('/api/entrance', entranceRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER_A = 42;
const OWNER_B = 99;

async function seedBranches() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
}

describe('entrance.routes wiring', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/entrance?branchId=1');
    expect(res.status).toBe(401);
  });

  it('is forbidden for a customer', async () => {
    await seedBranches();
    const res = await request(app).get('/api/entrance?branchId=1').set('Authorization', authHeader({ role: 1, accountId: 1 }));
    expect(res.status).toBe(403);
  });

  it('lets the owning branch admin create and list entrances', async () => {
    await seedBranches();
    const createRes = await request(app)
      .post('/api/entrance')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send({ branch_id: 1, name: 'Main lobby', code: 'G1' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.branch_id).toBe(1);

    const listRes = await request(app)
      .get('/api/entrance?branchId=1')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);
  });

  it("forbids a branch admin from touching another branch's entrances", async () => {
    await seedBranches();
    await Entrance.create({ id: 1, branch_id: 1, name: 'A gate' });
    const res = await request(app)
      .put('/api/entrance/1')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_B }))
      .send({ name: 'hijacked' });
    expect(res.status).toBe(403);
  });

  it('requires branchId for a branch-scoped caller listing without one', async () => {
    await seedBranches();
    const res = await request(app).get('/api/entrance').set('Authorization', authHeader({ role: 2, accountId: OWNER_A }));
    expect(res.status).toBe(400);
  });
});
