const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const scheduleRoutes = require('./schedule.routes');
const Cinema = require('../models/Cinema');
const Room = require('../models/Room');
const Movie = require('../models/Movie');
const Schedule = require('../models/Schedule');

const app = buildTestApp('/api/schedule', scheduleRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedBranches() {
  await Cinema.create([
    { id: 1, owner_id: 42, name: 'Branch A' },
    { id: 2, owner_id: 99, name: 'Branch B' },
  ]);
  await Room.create([
    { id: 1, cinema_id: 1, name: 'Room A1' },
    { id: 2, cinema_id: 2, name: 'Room B1' },
  ]);
  await Movie.create({ id: 1, name: 'Avengers', premiere_date: '2026-01-01', status: 'ACTIVE' });
}

const showtimePayload = (overrides = {}) => ({
  movie_id: 1,
  room_id: 1,
  movie_date: '2026-01-10',
  time_begin: '10:00',
  time_end: '12:00',
  price: 5000,
  ...overrides,
});

describe('schedule.routes wiring', () => {
  it('GET /api/schedule requires auth', async () => {
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(401);
  });

  it('GET /api/schedule/:id is public', async () => {
    const res = await request(app).get('/api/schedule/999');
    expect(res.status).toBe(404); // reached controller
  });

  it('GET /api/schedule allows an employee (role 3)', async () => {
    const res = await request(app).get('/api/schedule').set('Authorization', authHeader({ role: 3, accountId: 7 }));
    expect(res.status).toBe(200);
  });

  it('POST /api/schedule rejects a customer', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 1 }))
      .send(showtimePayload());
    expect(res.status).toBe(403);
  });

  it('POST /api/schedule rejects an employee (no schedule.create permission)', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 3, accountId: 7 }))
      .send(showtimePayload());
    expect(res.status).toBe(403);
  });

  it('POST /api/schedule allows a branch admin to create a showtime in their own branch', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send(showtimePayload({ room_id: 1 }));
    expect(res.status).toBe(201);
    expect(res.body.cinema_id).toBe(1);
  });

  it('POST /api/schedule forbids a branch admin from creating a showtime in another branch\'s room', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send(showtimePayload({ room_id: 2 }));
    expect(res.status).toBe(403);
  });

  it('POST /api/schedule allows super admin for any branch', async () => {
    await seedBranches();
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send(showtimePayload({ room_id: 2 }));
    expect(res.status).toBe(201);
    expect(res.body.cinema_id).toBe(2);
  });

  it('POST /api/schedule rejects a movie that is not ACTIVE', async () => {
    await seedBranches();
    await Movie.updateOne({ id: 1 }, { $set: { status: 'INACTIVE' } });
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send(showtimePayload());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MOVIE_NOT_ACTIVE');
  });

  it('PUT /api/schedule/:id forbids a branch admin from editing another branch\'s showtime', async () => {
    await seedBranches();
    await Schedule.create({ id: 1, movie_id: 1, room_id: 2, cinema_id: 2, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = await request(app)
      .put('/api/schedule/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ price: 6000 });
    expect(res.status).toBe(403);
  });

  it('PUT /api/schedule/:id allows a branch admin to edit their own showtime', async () => {
    await seedBranches();
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = await request(app)
      .put('/api/schedule/1')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ price: 6000 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(6000);
  });

  it('PATCH /api/schedule/:id/cancel forbids a branch admin from cancelling another branch\'s showtime', async () => {
    await seedBranches();
    await Schedule.create({ id: 1, movie_id: 1, room_id: 2, cinema_id: 2, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = await request(app)
      .patch('/api/schedule/1/cancel')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('PATCH /api/schedule/:id/cancel allows a branch admin to cancel their own showtime', async () => {
    await seedBranches();
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = await request(app)
      .patch('/api/schedule/1/cancel')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('DELETE /api/schedule/:id allows super admin', async () => {
    await seedBranches();
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = await request(app).delete('/api/schedule/1').set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
  });
});
