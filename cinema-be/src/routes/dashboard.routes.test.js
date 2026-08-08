const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const dashboardRoutes = require('./dashboard.routes');

const app = buildTestApp('/api', dashboardRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('dashboard.routes wiring', () => {
  it('GET /api/owner/dashboard requires auth', async () => {
    const res = await request(app).get('/api/owner/dashboard');
    expect(res.status).toBe(401);
  });

  it('GET /api/owner/dashboard rejects a plain user', async () => {
    const res = await request(app).get('/api/owner/dashboard').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/owner/dashboard allows a theater owner', async () => {
    const res = await request(app)
      .get('/api/owner/dashboard')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
  });

  it('GET /api/admin/dashboard rejects a theater owner (admin only)', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/dashboard allows admin', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', authHeader({ role: 0 }));
    expect(res.status).toBe(200);
  });
});
