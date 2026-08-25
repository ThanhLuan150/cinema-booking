jest.mock('../utils/socket', () => ({ emitPublic: jest.fn(), emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitToAccount: jest.fn() }));
jest.mock('../utils/uploadImage', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://cdn.example.com/a.jpg'),
  uploadTrailer: jest.fn().mockResolvedValue('https://cdn.example.com/t.mp4'),
}));

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const movieRoutes = require('./movie.routes');
const Movie = require('../models/Movie');

const app = buildTestApp('/api/movie', movieRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movie.routes wiring', () => {
  it('GET /api/movie is public', async () => {
    const res = await request(app).get('/api/movie');
    expect(res.status).toBe(200);
  });

  it('GET /api/movie/:id is public', async () => {
    await Movie.create({ id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app).get('/api/movie/1');
    expect(res.status).toBe(200);
  });

  it('GET /api/movie/mine requires auth', async () => {
    const res = await request(app).get('/api/movie/mine');
    expect(res.status).toBe(401);
  });

  it('GET /api/movie/mine allows a customer (movie.read is granted to every role)', async () => {
    const res = await request(app).get('/api/movie/mine').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(200);
  });

  it('GET /api/movie/mine allows a branch admin', async () => {
    const res = await request(app).get('/api/movie/mine').set('Authorization', authHeader({ role: 2, accountId: 1 }));
    expect(res.status).toBe(200);
  });

  it('GET /api/movie/mine allows an employee', async () => {
    const res = await request(app).get('/api/movie/mine').set('Authorization', authHeader({ role: 3, accountId: 1 }));
    expect(res.status).toBe(200);
  });

  it('GET /api/movie/mine?status=ACTIVE only returns active movies (Create Showtime movie picker)', async () => {
    await Movie.create([
      { id: 1, name: 'Active One', premiere_date: '2026-01-01', status: 'ACTIVE' },
      { id: 2, name: 'Disabled One', premiere_date: '2026-01-01', status: 'INACTIVE' },
    ]);
    const res = await request(app)
      .get('/api/movie/mine')
      .query({ status: 'ACTIVE' })
      .set('Authorization', authHeader({ role: 2, accountId: 1 }));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('Active One');
  });

  it('POST /api/movie requires auth', async () => {
    const res = await request(app).post('/api/movie').send({ name: 'A', premiere_date: '2026-01-01' });
    expect(res.status).toBe(401);
  });

  it('POST /api/movie rejects a plain user', async () => {
    const res = await request(app)
      .post('/api/movie')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ name: 'A', premiere_date: '2026-01-01' });
    expect(res.status).toBe(403);
  });

  it('POST /api/movie rejects a branch admin (Movie Catalog is Super Admin only)', async () => {
    const res = await request(app)
      .post('/api/movie')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'New Movie', premiere_date: '2026-01-01' });
    expect(res.status).toBe(403);
  });

  it('POST /api/movie rejects an employee (Movie Catalog is Super Admin only)', async () => {
    const res = await request(app)
      .post('/api/movie')
      .set('Authorization', authHeader({ role: 3, accountId: 42 }))
      .send({ name: 'New Movie', premiere_date: '2026-01-01' });
    expect(res.status).toBe(403);
  });

  it('POST /api/movie allows super admin and reaches the controller', async () => {
    const res = await request(app)
      .post('/api/movie')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ name: 'New Movie', premiere_date: '2026-01-01' });
    expect(res.status).toBe(201);
  });

  it('PUT /api/movie/:id requires auth', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app).put('/api/movie/1').send({ name: 'Hacked' });
    expect(res.status).toBe(401);
  });

  it('PUT /api/movie/:id forbids a branch admin from editing any movie', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .put('/api/movie/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/movie/:id forbids an employee from editing any movie', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .put('/api/movie/1')
      .set('Authorization', authHeader({ role: 3, accountId: 42 }))
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/movie/:id forbids a customer from editing any movie', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .put('/api/movie/1')
      .set('Authorization', authHeader({ role: 1, accountId: 42 }))
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/movie/:id allows super admin', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .put('/api/movie/1')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/movie/:id requires auth', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app).delete('/api/movie/1');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/movie/:id forbids a branch admin from deleting any movie', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .delete('/api/movie/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/movie/:id forbids an employee from deleting any movie', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .delete('/api/movie/1')
      .set('Authorization', authHeader({ role: 3, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/movie/:id forbids a customer from deleting any movie', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app)
      .delete('/api/movie/1')
      .set('Authorization', authHeader({ role: 1, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/movie/:id allows super admin', async () => {
    await Movie.create({ id: 1, owner_id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = await request(app).delete('/api/movie/1').set('Authorization', authHeader({ role: 0 }));
    expect(res.status).toBe(200);
  });
});
