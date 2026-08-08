const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const actorRoutes = require('./actor.routes');

const app = buildTestApp('/api/actor', actorRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('actor.routes wiring', () => {
  it('GET /api/actor is public', async () => {
    const res = await request(app).get('/api/actor');
    expect(res.status).toBe(200);
  });

  it('POST /api/actor requires auth', async () => {
    const res = await request(app).post('/api/actor').send({ full_name: 'A' });
    expect(res.status).toBe(401);
  });

  it('POST /api/actor rejects a branch admin (role 2)', async () => {
    const res = await request(app)
      .post('/api/actor')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ full_name: 'A' });
    expect(res.status).toBe(403);
  });

  it('POST /api/actor allows super admin (role 0)', async () => {
    const res = await request(app)
      .post('/api/actor')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ full_name: 'A' });
    expect(res.status).toBe(201);
  });
});
