const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const movieReleaseRoutes = require('./movieRelease.routes');
const Distributor = require('../models/Distributor');
const Movie = require('../models/Movie');
const MovieRelease = require('../models/MovieRelease');

const app = buildTestApp('/api/movie-releases', movieReleaseRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const superAdmin = () => authHeader({ role: 0, accountId: 1 });
const branchAdmin = () => authHeader({ role: 2, accountId: 42 });
const customer = () => authHeader({ role: 1, accountId: 7 });

async function seedBase() {
  await Movie.create({ id: 1, name: 'Avengers', premiere_date: '2026-01-01', status: 'ACTIVE' });
  await Distributor.create({ id: 1, name: 'CGV', code: 'CGV', status: 'ACTIVE' });
  await Distributor.create({ id: 2, name: 'Off', code: 'OFF', status: 'INACTIVE' });
}

describe('movieRelease.routes', () => {
  it('GET / requires auth', async () => {
    const res = await request(app).get('/api/movie-releases');
    expect(res.status).toBe(401);
  });

  it('GET / forbids a customer', async () => {
    const res = await request(app).get('/api/movie-releases').set('Authorization', customer());
    expect(res.status).toBe(403);
  });

  it('GET / allows a branch admin (read-only) and embeds movie + distributor summaries', async () => {
    await seedBase();
    await MovieRelease.create({ id: 1, movie_id: 1, distributor_id: 1, release_date: '2026-02-01', end_date: '2026-05-01' });
    const res = await request(app).get('/api/movie-releases').set('Authorization', branchAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].movie).toMatchObject({ id: 1, name: 'Avengers' });
    expect(res.body.data[0].distributor).toMatchObject({ id: 1, code: 'CGV' });
  });

  it('POST / forbids a branch admin (movieRelease.manage is SUPER_ADMIN only)', async () => {
    await seedBase();
    const res = await request(app)
      .post('/api/movie-releases')
      .set('Authorization', branchAdmin())
      .send({ movie_id: 1, distributor_id: 1, release_date: '2026-02-01' });
    expect(res.status).toBe(403);
  });

  it('POST / creates a release (super admin)', async () => {
    await seedBase();
    const res = await request(app)
      .post('/api/movie-releases')
      .set('Authorization', superAdmin())
      .send({ movie_id: 1, distributor_id: 1, release_date: '2026-02-01', end_date: '2026-05-01' });
    expect(res.status).toBe(201);
    expect(res.body.release_date).toBe('2026-02-01');
    expect(res.body.end_date).toBe('2026-05-01');
  });

  it('POST / accepts an open-ended run (no end_date)', async () => {
    await seedBase();
    const res = await request(app)
      .post('/api/movie-releases')
      .set('Authorization', superAdmin())
      .send({ movie_id: 1, distributor_id: 1, release_date: '2026-02-01' });
    expect(res.status).toBe(201);
    expect(res.body.end_date).toBeNull();
  });

  it('POST / rejects end_date before release_date', async () => {
    await seedBase();
    const res = await request(app)
      .post('/api/movie-releases')
      .set('Authorization', superAdmin())
      .send({ movie_id: 1, distributor_id: 1, release_date: '2026-05-01', end_date: '2026-02-01' });
    expect(res.status).toBe(400);
  });

  it('POST / rejects a non-YYYY-MM-DD release_date', async () => {
    await seedBase();
    const res = await request(app)
      .post('/api/movie-releases')
      .set('Authorization', superAdmin())
      .send({ movie_id: 1, distributor_id: 1, release_date: '01/02/2026' });
    expect(res.status).toBe(400);
  });

  it('POST / rejects an inactive distributor', async () => {
    await seedBase();
    const res = await request(app)
      .post('/api/movie-releases')
      .set('Authorization', superAdmin())
      .send({ movie_id: 1, distributor_id: 2, release_date: '2026-02-01' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DISTRIBUTOR_NOT_ACTIVE');
  });

  it('POST / rejects an unknown movie', async () => {
    await seedBase();
    const res = await request(app)
      .post('/api/movie-releases')
      .set('Authorization', superAdmin())
      .send({ movie_id: 999, distributor_id: 1, release_date: '2026-02-01' });
    expect(res.status).toBe(404);
  });

  it('POST / rejects a duplicate (movie, distributor) pair with 409', async () => {
    await seedBase();
    await MovieRelease.create({ id: 1, movie_id: 1, distributor_id: 1, release_date: '2026-02-01' });
    const res = await request(app)
      .post('/api/movie-releases')
      .set('Authorization', superAdmin())
      .send({ movie_id: 1, distributor_id: 1, release_date: '2026-03-01' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RELEASE_DUPLICATE');
  });

  it('PUT /:id updates the window', async () => {
    await seedBase();
    await MovieRelease.create({ id: 1, movie_id: 1, distributor_id: 1, release_date: '2026-02-01', end_date: '2026-05-01' });
    const res = await request(app)
      .put('/api/movie-releases/1')
      .set('Authorization', superAdmin())
      .send({ end_date: '' });
    expect(res.status).toBe(200);
    expect(res.body.end_date).toBeNull();
  });

  it('DELETE /:id removes the release', async () => {
    await seedBase();
    await MovieRelease.create({ id: 1, movie_id: 1, distributor_id: 1, release_date: '2026-02-01' });
    const res = await request(app).delete('/api/movie-releases/1').set('Authorization', superAdmin());
    expect(res.status).toBe(200);
    expect(await MovieRelease.countDocuments()).toBe(0);
  });
});
