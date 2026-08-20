const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const roomRoutes = require('./room.routes');
const Branch = require('../models/Branch');
const Room = require('../models/Room');

const app = buildTestApp('/api/room', roomRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
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
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = await request(app)
      .post('/api/room')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'A', cinema_id: 1 });
    expect(res.status).toBe(403);
  });

  it('POST /api/room allows the owning theater staff', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = await request(app)
      .post('/api/room')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'A', cinema_id: 1, code: 'R1', capacity: 40 });
    expect(res.status).toBe(201);
  });

  it('POST /api/room allows admin regardless of ownership', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    const res = await request(app)
      .post('/api/room')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send({ name: 'A', cinema_id: 1, code: 'R1', capacity: 40 });
    expect(res.status).toBe(201);
  });

  it('PUT /api/room/:id requires auth', async () => {
    const res = await request(app).put('/api/room/1').send({ name: 'New' });
    expect(res.status).toBe(401);
  });

  it('PUT /api/room/:id forbids a Branch Admin who does not own the room\'s branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'A' });
    const res = await request(app)
      .put('/api/room/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ status: 'MAINTENANCE' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/room/:id allows the owning Branch Admin to set the room to MAINTENANCE', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'A' });
    const res = await request(app)
      .put('/api/room/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ status: 'MAINTENANCE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('MAINTENANCE');
  });

  it('DELETE /api/room/:id requires auth', async () => {
    const res = await request(app).delete('/api/room/1');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/room/:id forbids a Branch Admin who does not own the room\'s branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'A' });
    const res = await request(app)
      .delete('/api/room/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/room/:id allows the owning Branch Admin', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'A' });
    const res = await request(app)
      .delete('/api/room/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
  });
});
