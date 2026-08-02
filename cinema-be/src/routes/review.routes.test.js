const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const reviewRoutes = require('./review.routes');

const app = buildTestApp('/api/review', reviewRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('review.routes wiring', () => {
  it('GET /api/review (moderation) requires admin', async () => {
    const res = await request(app).get('/api/review').set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/review/:movieId works without auth (optionalAuth)', async () => {
    const res = await request(app).get('/api/review/1');
    expect(res.status).toBe(200);
  });

  it('POST /api/review requires auth', async () => {
    const res = await request(app).post('/api/review').send({ movie_id: 1, rating: 5 });
    expect(res.status).toBe(401);
  });

  it('POST /api/review reaches the controller for an authenticated user', async () => {
    const res = await request(app)
      .post('/api/review')
      .set('Authorization', authHeader({ accountId: 1 }))
      .send({ movie_id: 1, rating: 5 });
    expect(res.status).toBe(201);
  });

  it('PUT /api/review/:id/hide requires admin', async () => {
    const res = await request(app)
      .put('/api/review/1/hide')
      .set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });
});
