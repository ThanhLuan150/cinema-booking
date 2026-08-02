const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const comboRoutes = require('./combo.routes');
const Cinema = require('../models/Cinema');

const app = buildTestApp('/api/combo', comboRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('combo.routes wiring', () => {
  it('GET /api/combo works without auth (optionalAuth)', async () => {
    const res = await request(app).get('/api/combo');
    expect(res.status).toBe(200);
  });

  it('POST /api/combo requires auth', async () => {
    const res = await request(app).post('/api/combo').send({ cinema_id: 1, name: 'A', price: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/combo forbids a non-owning theater staff', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    const res = await request(app)
      .post('/api/combo')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ cinema_id: 1, name: 'A', price: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/combo allows the owning theater staff', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = await request(app)
      .post('/api/combo')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ cinema_id: 1, name: 'A', price: 1 });
    expect(res.status).toBe(201);
  });
});
