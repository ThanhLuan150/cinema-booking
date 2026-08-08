const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const voucherRoutes = require('./voucher.routes');

const app = buildTestApp('/api/voucher', voucherRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('voucher.routes wiring', () => {
  it('GET /api/voucher requires auth', async () => {
    const res = await request(app).get('/api/voucher');
    expect(res.status).toBe(401);
  });

  it('GET /api/voucher rejects a plain user', async () => {
    const res = await request(app).get('/api/voucher').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/voucher/validate only requires auth (any role)', async () => {
    const res = await request(app)
      .post('/api/voucher/validate')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ code: 'NOPE' });
    expect(res.status).toBe(404); // reached controller
  });

  it('POST /api/voucher requires admin/theater-staff role', async () => {
    const res = await request(app)
      .post('/api/voucher')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ code: 'X', discount_type: 'fixed', discount_value: 1 });
    expect(res.status).toBe(403);
  });
});
