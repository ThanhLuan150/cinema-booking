const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const holidayRoutes = require('./holiday.routes');

const app = buildTestApp('/api/pricingHoliday', holidayRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('holiday.routes wiring', () => {
  it('GET /api/pricingHoliday requires auth', async () => {
    const res = await request(app).get('/api/pricingHoliday');
    expect(res.status).toBe(401);
  });

  it('GET /api/pricingHoliday rejects a plain customer', async () => {
    const res = await request(app).get('/api/pricingHoliday').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/pricingHoliday reaches the controller for a super admin', async () => {
    const res = await request(app)
      .post('/api/pricingHoliday')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ date: '2026-12-25', name: 'Christmas' });
    expect(res.status).toBe(201);
  });

  it('POST /api/pricingHoliday requires branch-admin/admin role', async () => {
    const res = await request(app)
      .post('/api/pricingHoliday')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ date: '2026-12-25' });
    expect(res.status).toBe(403);
  });
});
