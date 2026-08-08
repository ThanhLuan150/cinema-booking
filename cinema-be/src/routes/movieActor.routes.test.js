const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const movieActorRoutes = require('./movieActor.routes');
const Movie = require('../models/Movie');

const app = buildTestApp('/api/movieActor', movieActorRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movieActor.routes wiring', () => {
  it('GET /api/movieActor is public', async () => {
    const res = await request(app).get('/api/movieActor');
    expect(res.status).toBe(200);
  });

  it('POST /api/movieActor requires auth', async () => {
    const res = await request(app).post('/api/movieActor').send({ movie_id: 1, actor_id: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/movieActor forbids a branch admin (no movie.update permission)', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .post('/api/movieActor')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ movie_id: 1, actor_id: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/movieActor allows super admin', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .post('/api/movieActor')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ movie_id: 1, actor_id: 1 });
    expect(res.status).toBe(201);
  });
});
