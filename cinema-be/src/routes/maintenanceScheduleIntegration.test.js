// End-to-end proof of Ticket 21's core business rule: a Room under an open maintenance issue
// blocks new Showtimes (enforced in schedule.controller.js), but any Showtime that already
// existed before the issue was reported is left completely alone — no auto-cancel.
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const maintenanceRequestRoutes = require('./maintenanceRequest.routes');
const scheduleRoutes = require('./schedule.routes');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Movie = require('../models/Movie');
const Seat = require('../models/Seat');
const Schedule = require('../models/Schedule');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/maintenance', maintenanceRequestRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use((err, req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

const app = buildApp();
const OWNER_A = 42;

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedBranchMovieRoomSeat() {
  await Branch.create({ id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' });
  await Movie.create({ id: 1, name: 'A', premiere_date: '2026-01-01', status: 'ACTIVE' });
  await Room.create({ id: 1, cinema_id: 1, name: 'Room 1', code: 'R1', status: 'ACTIVE' });
  await Seat.create({ id: 1, room_id: 1, row: 'A', number: 1, seat_code: 'A1', status: 'ACTIVE' });
}

const showtimePayload = (overrides = {}) => ({
  movie_id: 1,
  room_id: 1,
  movie_date: '2026-03-01',
  time_begin: '10:00',
  time_end: '12:00',
  price: 100000,
  ...overrides,
});

describe('Maintenance <-> Schedule integration (Ticket 21 business rule)', () => {
  it('blocks a new Showtime once a ROOM maintenance request puts the room into MAINTENANCE', async () => {
    await seedBranchMovieRoomSeat();

    const maintRes = await request(app)
      .post('/api/maintenance')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send({ branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Projector flickers' });
    expect(maintRes.status).toBe(201);
    expect((await Room.findOne({ id: 1 })).status).toBe('MAINTENANCE');

    const scheduleRes = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send(showtimePayload());
    expect(scheduleRes.status).toBe(400);
    expect(scheduleRes.body.code).toBe('ROOM_NOT_ACTIVE');
  });

  it('does not auto-cancel a Showtime that already existed when the maintenance request was opened', async () => {
    await seedBranchMovieRoomSeat();

    const scheduleRes = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send(showtimePayload());
    expect(scheduleRes.status).toBe(201);
    const scheduleId = scheduleRes.body.id;

    const maintRes = await request(app)
      .post('/api/maintenance')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send({ branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Projector flickers' });
    expect(maintRes.status).toBe(201);
    expect((await Room.findOne({ id: 1 })).status).toBe('MAINTENANCE');

    // The pre-existing showtime is completely untouched — still there.
    const stillThere = await Schedule.findOne({ id: scheduleId });
    expect(stillThere).not.toBeNull();
  });

  it('allows new Showtimes again once the maintenance request is resolved', async () => {
    await seedBranchMovieRoomSeat();

    const maintRes = await request(app)
      .post('/api/maintenance')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send({ branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Projector flickers' });
    const requestId = maintRes.body.id;

    const maintPosition = await Position.findOne({ code: 'MAINTENANCE_STAFF' });
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: maintPosition.id, status: 1 });

    await request(app)
      .post(`/api/maintenance/${requestId}/assign`)
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send({ employee_id: 1 });
    await request(app)
      .post(`/api/maintenance/${requestId}/start`)
      .set('Authorization', authHeader({ role: 3, accountId: 7 }));
    const resolveRes = await request(app)
      .post(`/api/maintenance/${requestId}/resolve`)
      .set('Authorization', authHeader({ role: 3, accountId: 7 }))
      .send({ resolution_note: 'Replaced the bulb' });
    expect(resolveRes.status).toBe(200);
    expect((await Room.findOne({ id: 1 })).status).toBe('ACTIVE');

    const scheduleRes = await request(app)
      .post('/api/schedule')
      .set('Authorization', authHeader({ role: 2, accountId: OWNER_A }))
      .send(showtimePayload());
    expect(scheduleRes.status).toBe(201);
  });
});
