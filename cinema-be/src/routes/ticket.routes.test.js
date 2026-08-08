const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const ticketRoutes = require('./ticket.routes');
const Cinema = require('../models/Cinema');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');

const app = buildTestApp('/api/ticket', ticketRoutes);

async function seedTicketAtCinema({ cinemaId, ownerId, ticketId = 1, status = 1 }) {
  await Cinema.create({ id: cinemaId, owner_id: ownerId, name: `Cinema ${cinemaId}` });
  await Room.create({ id: cinemaId, cinema_id: cinemaId, name: `Room ${cinemaId}` });
  await Schedule.create({
    id: cinemaId,
    movie_id: 1,
    room_id: cinemaId,
    movie_date: '2026-01-01',
    time_begin: '10:00',
    time_end: '12:00',
    price: 1,
  });
  await Ticket.create({ id: ticketId, schedule_id: cinemaId, seat_index: 0, seat_code: 'A1', status });
}

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('ticket.routes wiring', () => {
  it('POST /api/ticket requires auth', async () => {
    const res = await request(app).post('/api/ticket').send({ schedule_id: 1 });
    expect(res.status).toBe(401);
  });

  it('POST /api/ticket requires admin role', async () => {
    const res = await request(app)
      .post('/api/ticket')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ schedule_id: 1 });
    expect(res.status).toBe(403);
  });

  it('PUT /api/ticket/:id requires auth', async () => {
    const res = await request(app).put('/api/ticket/999');
    expect(res.status).toBe(401);
  });

  it('PUT /api/ticket/:id rejects a customer (no ticket.checkin permission)', async () => {
    await seedTicketAtCinema({ cinemaId: 1, ownerId: 42 });
    const res = await request(app)
      .put('/api/ticket/1')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }));
    expect(res.status).toBe(403);
  });

  it('PUT /api/ticket/:id rejects a branch admin who does not own the ticket\'s cinema', async () => {
    await seedTicketAtCinema({ cinemaId: 1, ownerId: 42 });
    const res = await request(app)
      .put('/api/ticket/1')
      .set('Authorization', authHeader({ role: 2, accountId: 99 }));
    expect(res.status).toBe(403);
    expect((await Ticket.findOne({ id: 1 })).status).toBe(1);
  });

  it('PUT /api/ticket/:id allows the owning branch admin to mark the ticket sold', async () => {
    await seedTicketAtCinema({ cinemaId: 1, ownerId: 42 });
    const res = await request(app)
      .put('/api/ticket/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
    expect((await Ticket.findOne({ id: 1 })).status).toBe(0);
  });

  it('PUT /api/ticket/:id allows super admin regardless of cinema ownership', async () => {
    await seedTicketAtCinema({ cinemaId: 1, ownerId: 42 });
    const res = await request(app)
      .put('/api/ticket/1')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
    expect((await Ticket.findOne({ id: 1 })).status).toBe(0);
  });

  it('PUT /api/ticket/:id returns 404 for an unknown ticket', async () => {
    const res = await request(app)
      .put('/api/ticket/999')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(404);
  });
});
