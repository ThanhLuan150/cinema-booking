const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const pricingRuleRoutes = require('./pricingRule.routes');

const app = buildTestApp('/api/pricingRule', pricingRuleRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('pricingRule.routes wiring', () => {
  it('GET /api/pricingRule requires auth', async () => {
    const res = await request(app).get('/api/pricingRule');
    expect(res.status).toBe(401);
  });

  it('GET /api/pricingRule rejects a plain customer', async () => {
    const res = await request(app).get('/api/pricingRule').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/pricingRule allows a branch admin (scoped)', async () => {
    const res = await request(app).get('/api/pricingRule').set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(200);
  });

  it('POST /api/pricingRule requires branch-admin/admin role', async () => {
    const res = await request(app)
      .post('/api/pricingRule')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ name: 'X', price: 1000 });
    expect(res.status).toBe(403);
  });

  it('POST /api/pricingRule reaches the controller for a super admin', async () => {
    const res = await request(app)
      .post('/api/pricingRule')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ name: 'Global Standard', price: 80000 });
    expect(res.status).toBe(201);
  });

  it('PUT /api/pricingRule/:id requires auth', async () => {
    const res = await request(app).put('/api/pricingRule/1').send({ price: 1 });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/pricingRule/:id requires auth', async () => {
    const res = await request(app).delete('/api/pricingRule/1');
    expect(res.status).toBe(401);
  });
});
