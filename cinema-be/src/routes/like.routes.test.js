const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const likeRoutes = require('./like.routes');

const app = buildTestApp('/api', likeRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('like.routes wiring', () => {
  it('GET /api/like/:movieId is public', async () => {
    const res = await request(app).get('/api/like/1');
    expect(res.status).toBe(200);
    expect(res.body).toBe(0);
  });

  it('GET /api/like/mine requires auth', async () => {
    const res = await request(app).get('/api/like/mine');
    expect(res.status).toBe(401);
  });

  it('POST /api/like requires auth', async () => {
    const res = await request(app).post('/api/like').send({ movie_id: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/like reaches the controller for an authenticated user', async () => {
    const res = await request(app)
      .post('/api/like')
      .set('Authorization', authHeader({ accountId: 42 }))
      .send({ movie_id: 1 });
    expect(res.status).toBe(201);
  });
});
