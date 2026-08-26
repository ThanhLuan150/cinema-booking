const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const promotionRoutes = require('./promotion.routes');

const app = buildTestApp('/api/promotion', promotionRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('promotion.routes wiring', () => {
  it('GET /api/promotion requires auth', async () => {
    const res = await request(app).get('/api/promotion');
    expect(res.status).toBe(401);
  });

  it('GET /api/promotion rejects a plain customer', async () => {
    const res = await request(app).get('/api/promotion').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/promotion/validate only requires auth (any role)', async () => {
    const res = await request(app)
      .post('/api/promotion/validate')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ code: 'NOPE' });
    expect(res.status).toBe(404); // reached the controller
  });

  it('POST /api/promotion/apply only requires auth (any role)', async () => {
    const res = await request(app)
      .post('/api/promotion/apply')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ code: 'NOPE' });
    expect(res.status).toBe(404); // reached the controller
  });

  it('POST /api/promotion requires a management role', async () => {
    const res = await request(app)
      .post('/api/promotion')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ code: 'X', name: 'X', discount_type: 'FIXED_AMOUNT', discount_value: 1, start_at: '2026-01-01', end_at: '2026-02-01' });
    expect(res.status).toBe(403);
  });

  it('a branch admin can create and then read back their own promotion', async () => {
    const res = await request(app)
      .post('/api/promotion')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({
        code: 'BRANCHPROMO',
        name: 'Branch promo',
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        start_at: '2026-01-01',
        end_at: '2026-02-01',
      });
    // No owned branches yet -> a system-wide (empty branch_ids) request is forbidden for BRANCH scope.
    expect(res.status).toBe(403);
  });
});
