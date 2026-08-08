const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const directorRoutes = require('./director.routes');

const app = buildTestApp('/api/director', directorRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('director.routes wiring', () => {
  it('GET /api/director is public', async () => {
    const res = await request(app).get('/api/director');
    expect(res.status).toBe(200);
  });

  it('POST /api/director requires auth', async () => {
    const res = await request(app).post('/api/director').send({ full_name: 'A' });
    expect(res.status).toBe(401);
  });

  it('POST /api/director rejects a branch admin (role 2)', async () => {
    const res = await request(app)
      .post('/api/director')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ full_name: 'A' });
    expect(res.status).toBe(403);
  });

  it('POST /api/director allows super admin (role 0)', async () => {
    const res = await request(app)
      .post('/api/director')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ full_name: 'A' });
    expect(res.status).toBe(201);
  });
});
