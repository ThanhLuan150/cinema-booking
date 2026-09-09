const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const distributorRoutes = require('./distributor.routes');
const Distributor = require('../models/Distributor');
const Movie = require('../models/Movie');
const MovieRelease = require('../models/MovieRelease');

const app = buildTestApp('/api/distributors', distributorRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const superAdmin = () => authHeader({ role: 0, accountId: 1 });
const branchAdmin = () => authHeader({ role: 2, accountId: 42 });
const customer = () => authHeader({ role: 1, accountId: 7 });

describe('distributor.routes', () => {
  it('GET / requires auth', async () => {
    const res = await request(app).get('/api/distributors');
    expect(res.status).toBe(401);
  });

  it('GET / forbids a branch admin (distributor.read is SUPER_ADMIN only)', async () => {
    const res = await request(app).get('/api/distributors').set('Authorization', branchAdmin());
    expect(res.status).toBe(403);
  });

  it('GET / forbids a customer', async () => {
    const res = await request(app).get('/api/distributors').set('Authorization', customer());
    expect(res.status).toBe(403);
  });

  it('GET / allows a super admin and paginates', async () => {
    await Distributor.create({ id: 1, name: 'CGV', code: 'CGV' });
    const res = await request(app).get('/api/distributors').set('Authorization', superAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('POST / creates a distributor (super admin), uppercasing the code', async () => {
    const res = await request(app)
      .post('/api/distributors')
      .set('Authorization', superAdmin())
      .send({ name: 'Galaxy Studio', code: 'galaxy', contact_email: 'a@b.com', phone: '0123' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('GALAXY');
    expect(res.body.status).toBe('ACTIVE');
  });

  it('POST / rejects a bad email', async () => {
    const res = await request(app)
      .post('/api/distributors')
      .set('Authorization', superAdmin())
      .send({ name: 'X', code: 'XX', contact_email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('POST / rejects a duplicate code with 409', async () => {
    await Distributor.create({ id: 1, name: 'A', code: 'DUP' });
    const res = await request(app)
      .post('/api/distributors')
      .set('Authorization', superAdmin())
      .send({ name: 'B', code: 'dup' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DISTRIBUTOR_CODE_TAKEN');
  });

  it('POST / forbids a branch admin', async () => {
    const res = await request(app)
      .post('/api/distributors')
      .set('Authorization', branchAdmin())
      .send({ name: 'B', code: 'BB' });
    expect(res.status).toBe(403);
  });

  it('PUT /:id updates a distributor', async () => {
    await Distributor.create({ id: 1, name: 'Old', code: 'OLD' });
    const res = await request(app)
      .put('/api/distributors/1')
      .set('Authorization', superAdmin())
      .send({ name: 'New', status: 'INACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New');
    expect(res.body.status).toBe('INACTIVE');
  });

  it('DELETE /:id removes an unused distributor', async () => {
    await Distributor.create({ id: 1, name: 'A', code: 'A1' });
    const res = await request(app).delete('/api/distributors/1').set('Authorization', superAdmin());
    expect(res.status).toBe(200);
    expect(await Distributor.countDocuments()).toBe(0);
  });

  it('DELETE /:id is blocked (409) while a movie release still references it', async () => {
    await Distributor.create({ id: 1, name: 'A', code: 'A1' });
    await Movie.create({ id: 1, name: 'M', premiere_date: '2026-01-01' });
    await MovieRelease.create({ id: 1, movie_id: 1, distributor_id: 1, release_date: '2026-01-01' });
    const res = await request(app).delete('/api/distributors/1').set('Authorization', superAdmin());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DISTRIBUTOR_IN_USE');
  });
});
