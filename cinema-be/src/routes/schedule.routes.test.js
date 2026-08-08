const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const scheduleRoutes = require('./schedule.routes');

const app = buildTestApp('/api/schedule', scheduleRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('schedule.routes wiring', () => {
  it('GET /api/schedule requires auth', async () => {
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(401);
  });

  it('GET /api/schedule/:id is public', async () => {
    const res = await request(app).get('/api/schedule/999');
    expect(res.status).toBe(404); // reached controller
  });

  it('POST /api/schedule requires admin (role 0), not just theater staff', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    expect(res.status).toBe(403);
  });

  it('GET /api/schedule allows an employee (role 3)', async () => {
    const res = await request(app).get('/api/schedule').set('Authorization', authHeader({ role: 3, accountId: 7 }));
    expect(res.status).toBe(200);
  });

  it('POST /api/schedule allows admin', async () => {
    const res = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    expect(res.status).toBe(201);
  });
});
