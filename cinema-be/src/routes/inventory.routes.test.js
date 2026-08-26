const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const inventoryRoutes = require('./inventory.routes');
const inventoryRepository = require('../repositories/inventory.repository');
const Branch = require('../models/Branch');

const app = buildTestApp('/api/inventory', inventoryRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('inventory.routes wiring', () => {
  it('GET /api/inventory requires auth', async () => {
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);
  });

  it('a Customer (no inventory permission) is forbidden', async () => {
    const res = await request(app).get('/api/inventory').set('Authorization', authHeader({ role: 1, accountId: 1 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/inventory forbids a non-owning Branch Admin', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ branch_id: 1, item: 'Popcorn', unit: 'pcs', quantity: 10, minimum_quantity: 5 });
    expect(res.status).toBe(403);
  });

  it('POST /api/inventory allows the owning Branch Admin', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ branch_id: 1, item: 'Popcorn', unit: 'pcs', quantity: 10, minimum_quantity: 5 });
    expect(res.status).toBe(201);
    expect(res.body.branch_id).toBe(1);
  });

  it('Super Admin (ALL scope) can manage any branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ branch_id: 1, item: 'Popcorn', unit: 'pcs', quantity: 10, minimum_quantity: 5 });
    expect(res.status).toBe(201);
  });

  it('POST /api/inventory/:id/receive is forbidden for a non-owning Branch Admin', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 10, minimumQuantity: 5, unit: 'pcs' });
    const res = await request(app)
      .post(`/api/inventory/${item.id}/receive`)
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ quantity: 5 });
    expect(res.status).toBe(403);
  });

  it('POST /api/inventory/:id/receive succeeds for the owning Branch Admin', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const item = await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 10, minimumQuantity: 5, unit: 'pcs' });
    const res = await request(app)
      .post(`/api/inventory/${item.id}/receive`)
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ quantity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(15);
  });

  it('GET /api/inventory/alerts is not shadowed by the /:id route', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await inventoryRepository.create({ branchId: 1, item: 'Popcorn', quantity: 1, minimumQuantity: 5, unit: 'pcs' });
    const res = await request(app)
      .get('/api/inventory/alerts')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });
});
