jest.mock('../utils/socket', () => ({ emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitPublic: jest.fn() }));

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const cinemaRoutes = require('./cinema.routes');
const Cinema = require('../models/Cinema');

const app = buildTestApp('/api/cinema', cinemaRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('cinema.routes wiring', () => {
  it('GET /api/cinema is public', async () => {
    const res = await request(app).get('/api/cinema');
    expect(res.status).toBe(200);
  });

  it('GET /api/cinema/mine requires auth', async () => {
    const res = await request(app).get('/api/cinema/mine');
    expect(res.status).toBe(401);
  });

  it('GET /api/cinema/pending requires admin', async () => {
    const res = await request(app).get('/api/cinema/pending').set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/cinema/top is public', async () => {
    const res = await request(app).get('/api/cinema/top');
    expect(res.status).toBe(200);
  });

  it('PUT /api/cinema/:id forbids a non-owning theater staff', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    const res = await request(app)
      .put('/api/cinema/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/cinema/:id allows the owning theater staff', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = await request(app)
      .put('/api/cinema/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('PUT /api/cinema/:id/approve requires admin', async () => {
    const res = await request(app)
      .put('/api/cinema/1/approve')
      .set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/cinema/branch-admin requires auth', async () => {
    const res = await request(app)
      .post('/api/cinema/branch-admin')
      .send({ email: 'a@b.com', password: 'pw', cinema_name: 'A' });
    expect(res.status).toBe(401);
  });

  it('POST /api/cinema/branch-admin forbids a branch admin (super admin only)', async () => {
    const res = await request(app)
      .post('/api/cinema/branch-admin')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_name: 'A' });
    expect(res.status).toBe(403);
  });

  it('POST /api/cinema/branch-admin allows super admin', async () => {
    const res = await request(app)
      .post('/api/cinema/branch-admin')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ email: 'a@b.com', password: 'pw', cinema_name: 'A' });
    expect(res.status).toBe(201);
  });
});
