const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seatRoutes = require('./seat.routes');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Seat = require('../models/Seat');

const app = buildTestApp('/api/seat', seatRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('seat.routes wiring', () => {
  it('GET /api/seat/room/:roomId is public', async () => {
    const res = await request(app).get('/api/seat/room/1');
    expect(res.status).toBe(200);
  });

  it('POST /api/seat/room/:roomId/generate requires auth', async () => {
    const res = await request(app).post('/api/seat/room/1/generate').send({ rows: ['A'], seatsPerRow: 2 });
    expect(res.status).toBe(401);
  });

  it('POST /api/seat/room/:roomId/generate forbids a non-owning theater staff', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    const res = await request(app)
      .post('/api/seat/room/1/generate')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ rows: ['A'], seatsPerRow: 2 });
    expect(res.status).toBe(403);
  });

  it('POST /api/seat/room/:roomId/generate allows the owning theater staff', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    const res = await request(app)
      .post('/api/seat/room/1/generate')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ rows: ['A'], seatsPerRow: 2 });
    expect(res.status).toBe(201);
  });

  it('PUT /api/seat/:id requires auth', async () => {
    const res = await request(app).put('/api/seat/1').send({ status: 'DISABLED' });
    expect(res.status).toBe(401);
  });

  it('PUT /api/seat/:id forbids a Branch Admin who does not own the seat\'s branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
    const res = await request(app)
      .put('/api/seat/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ status: 'DISABLED' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/seat/:id allows the owning Branch Admin to disable a seat', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    await Seat.create({ id: 1, room_id: 1, seat_code: 'A1' });
    const res = await request(app)
      .put('/api/seat/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ status: 'DISABLED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DISABLED');
  });
});
