jest.mock('../utils/socket', () => ({ emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitToAccount: jest.fn(), emitPublic: jest.fn() }));

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const branchRoutes = require('./branch.routes');
const Branch = require('../models/Branch');
const Company = require('../models/Company');
const Employee = require('../models/Employee');

const app = buildTestApp('/api/cinema', branchRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedCompany(id = 1) {
  return Company.create({ id, name: 'Acme', code: `ACME${id}`, status: 'ACTIVE' });
}

async function seedTwoBranches() {
  await seedCompany();
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A', status: 'ACTIVE' },
    { id: 2, company_id: 1, owner_id: 99, name: 'Branch B', code: 'B', status: 'ACTIVE' },
  ]);
}

describe('branch.routes wiring — public endpoints', () => {
  it('GET /api/cinema is public', async () => {
    const res = await request(app).get('/api/cinema');
    expect(res.status).toBe(200);
  });

  it('GET /api/cinema/top is public', async () => {
    const res = await request(app).get('/api/cinema/top');
    expect(res.status).toBe(200);
  });

  it('GET /api/cinema/:id is public', async () => {
    const res = await request(app).get('/api/cinema/999');
    expect(res.status).toBe(404);
  });
});

describe('branch.routes wiring — authorization', () => {
  it('GET /api/cinema/mine requires auth', async () => {
    const res = await request(app).get('/api/cinema/mine');
    expect(res.status).toBe(401);
  });

  it('GET /api/cinema/mine forbids a customer (no branch.read permission)', async () => {
    const res = await request(app).get('/api/cinema/mine').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/cinema/branch-admin requires auth', async () => {
    const res = await request(app)
      .post('/api/cinema/branch-admin')
      .send({ email: 'a@b.com', password: 'pw', cinema_name: 'A' });
    expect(res.status).toBe(401);
  });

  it('POST /api/cinema/branch-admin forbids a branch admin (super admin only)', async () => {
    const res = await request(app)
      .post('/api/cinema/branch-admin')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_name: 'A' });
    expect(res.status).toBe(403);
  });

  it('POST /api/cinema/branch-admin allows super admin', async () => {
    await seedCompany();
    const res = await request(app)
      .post('/api/cinema/branch-admin')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_name: 'A', company_id: 1, code: 'A' });
    expect(res.status).toBe(201);
  });

  it('POST /api/cinema/branch-admin allows super admin without a company_id, defaulting to Default Company', async () => {
    const res = await request(app)
      .post('/api/cinema/branch-admin')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_name: 'A', code: 'A' });
    expect(res.status).toBe(201);
    const defaultCompany = await Company.findOne({ code: 'DEFAULT' });
    expect(res.body.company_id).toBe(defaultCompany.id);
  });

  it('POST /api/cinema forbids a branch admin (no self-service branch creation)', async () => {
    await seedCompany();
    const res = await request(app)
      .post('/api/cinema')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ company_id: 1, name: 'New Branch', code: 'NB' });
    expect(res.status).toBe(403);
  });

  it('POST /api/cinema allows super admin and creates an ACTIVE branch', async () => {
    await seedCompany();
    const res = await request(app)
      .post('/api/cinema')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ company_id: 1, name: 'New Branch', code: 'NB' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
  });
});

describe('branch.routes wiring — cross-branch security', () => {
  it('GET /api/cinema/:id/detail forbids a Branch Admin from viewing another branch\'s data', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .get('/api/cinema/2/detail')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/cinema/:id/detail allows a Branch Admin to view their own branch', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .get('/api/cinema/1/detail')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Branch A');
  });

  it('GET /api/cinema/:id/detail allows Super Admin to view any branch', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .get('/api/cinema/2/detail')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
  });

  it('GET /api/cinema/:id/detail forbids an Employee (branch.read is not granted to any Position by default)', async () => {
    await seedTwoBranches();
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 1 });

    const res = await request(app)
      .get('/api/cinema/1/detail')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }));
    expect(res.status).toBe(403);
  });

  it('PUT /api/cinema/:id forbids a Branch Admin from modifying another branch', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .put('/api/cinema/2')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
    expect((await Branch.findOne({ id: 2 })).name).toBe('Branch B');
  });

  it('PUT /api/cinema/:id allows a Branch Admin to update their own branch, but not its scope', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .put('/api/cinema/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'Updated', company_id: 999 });
    expect(res.status).toBe(200);
    const updated = await Branch.findOne({ id: 1 });
    expect(updated.name).toBe('Updated');
    expect(updated.company_id).toBe(1); // company_id silently ignored for BRANCH scope
  });

  it('PUT /api/cinema/:id/activate forbids a Branch Admin even for their own branch (super admin only)', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .put('/api/cinema/1/activate')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('PUT /api/cinema/:id/disable allows super admin to disable any branch', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .put('/api/cinema/2/disable')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
    expect((await Branch.findOne({ id: 2 })).status).toBe('INACTIVE');
  });

  it('PUT /api/cinema/:id/maintenance allows super admin to put a branch under maintenance', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .put('/api/cinema/1/maintenance')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
    expect((await Branch.findOne({ id: 1 })).status).toBe('MAINTENANCE');
  });

  it('PUT /api/cinema/:id/assign-admin forbids a Branch Admin (super admin only)', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .put('/api/cinema/1/assign-admin')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ account_id: 7 });
    expect(res.status).toBe(403);
  });

  it('PUT /api/cinema/:id/assign-admin allows super admin to reassign a branch', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .put('/api/cinema/1/assign-admin')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ account_id: 7 });
    expect(res.status).toBe(200);
    expect((await Branch.findOne({ id: 1 })).owner_id).toBe(7);
  });

  it('DELETE /api/cinema/:id forbids a Branch Admin (super admin only)', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .delete('/api/cinema/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/cinema/:id refuses to delete a branch with active employees', async () => {
    await seedTwoBranches();
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 1 });
    const res = await request(app)
      .delete('/api/cinema/1')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(409);
  });

  it('DELETE /api/cinema/:id allows super admin to delete a branch with no dependents', async () => {
    await seedTwoBranches();
    const res = await request(app)
      .delete('/api/cinema/2')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
    expect(await Branch.countDocuments({ id: 2 })).toBe(0);
  });
});
