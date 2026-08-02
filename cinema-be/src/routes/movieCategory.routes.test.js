const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const movieCategoryRoutes = require('./movieCategory.routes');

const app = buildTestApp('/api/movieCat', movieCategoryRoutes);

beforeAll(async () => connect());
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

  it('DELETE /api/movieCat/:movieId requires admin/theater-staff role', async () => {
    const res = await request(app)
      .delete('/api/movieCat/1')
      .set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(200);
  });
});
