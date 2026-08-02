const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const categoryRoutes = require('./category.routes');

const app = buildTestApp('/api/cat', categoryRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('category.routes wiring', () => {
  it('GET /api/cat is public', async () => {
    const res = await request(app).get('/api/cat');
    expect(res.status).toBe(200);
  });

  it('POST /api/cat requires auth', async () => {
    const res = await request(app).post('/api/cat').send({ name: 'Action' });
    expect(res.status).toBe(401);
  });

  it('POST /api/cat rejects a plain user (role 1)', async () => {
    const res = await request(app)
      .post('/api/cat')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ name: 'Action' });
    expect(res.status).toBe(403);
  });

  it('POST /api/cat allows admin (role 0)', async () => {
    const res = await request(app)
      .post('/api/cat')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ name: 'Action' });
    expect(res.status).toBe(201);
  });
});
