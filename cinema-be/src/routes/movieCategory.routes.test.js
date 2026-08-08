const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const movieCategoryRoutes = require('./movieCategory.routes');
const Movie = require('../models/Movie');

const app = buildTestApp('/api/movieCat', movieCategoryRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movieCategory.routes wiring', () => {
  it('GET /api/movieCat is public', async () => {
    const res = await request(app).get('/api/movieCat');
    expect(res.status).toBe(200);
  });

  it('POST /api/movieCat requires auth', async () => {
    const res = await request(app).post('/api/movieCat').send({ movie_id: 1, cat_id: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/movieCat rejects a plain user', async () => {
    const res = await request(app)
      .post('/api/movieCat')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ movie_id: 1, cat_id: 1 });
    expect(res.status).toBe(403);
  });

  it('DELETE /api/movieCat/:movieId forbids a branch admin clearing tags on a movie they did not create', async () => {
    await Movie.create({ id: 1, owner_id: 99, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .delete('/api/movieCat/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/movieCat/:movieId allows a branch admin who created the movie', async () => {
    await Movie.create({ id: 1, owner_id: 42, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .delete('/api/movieCat/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
  });
});
