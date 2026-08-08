const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const movieDirectorRoutes = require('./movieDirector.routes');
const Movie = require('../models/Movie');

const app = buildTestApp('/api/movieDirector', movieDirectorRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movieDirector.routes wiring', () => {
  it('GET /api/movieDirector is public', async () => {
    const res = await request(app).get('/api/movieDirector');
    expect(res.status).toBe(200);
  });

  it('POST /api/movieDirector requires auth', async () => {
    const res = await request(app).post('/api/movieDirector').send({ movie_id: 1, director_id: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/movieDirector forbids a branch admin tagging a movie they did not create', async () => {
    await Movie.create({ id: 1, owner_id: 99, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .post('/api/movieDirector')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ movie_id: 1, director_id: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/movieDirector allows a branch admin who created the movie', async () => {
    await Movie.create({ id: 1, owner_id: 42, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .post('/api/movieDirector')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ movie_id: 1, director_id: 1 });
    expect(res.status).toBe(201);
  });
});
