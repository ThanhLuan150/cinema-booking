const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const roomRoutes = require('./room.routes');
const Cinema = require('../models/Cinema');

const app = buildTestApp('/api/room', roomRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('room.routes wiring', () => {
  it('GET /api/room is public', async () => {
    const res = await request(app).get('/api/room');
    expect(res.status).toBe(200);
  });

  it('POST /api/room requires auth', async () => {
    const res = await request(app).post('/api/room').send({ name: 'A', cinema_id: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/room forbids an owner who does not own the cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    const res = await request(app)
      .post('/api/room')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'A', cinema_id: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/room allows the owning theater staff', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = await request(app)
      .post('/api/room')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'A', cinema_id: 1 });
    expect(res.status).toBe(201);
  });

  it('POST /api/room allows admin regardless of ownership', async () => {
    await Cinema.create({ id: 1, owner_id: 99, name: 'A' });
    const res = await request(app)
      .post('/api/room')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ name: 'A', cinema_id: 1 });
    expect(res.status).toBe(201);
  });
});
