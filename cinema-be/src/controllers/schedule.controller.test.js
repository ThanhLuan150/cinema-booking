const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const scheduleController = require('./schedule.controller');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const Movie = require('../models/Movie');
const Seat = require('../models/Seat');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedMovieAndRoom({
  movieStatus = 'ACTIVE',
  roomStatus = 'ACTIVE',
  premiere_date = '2026-01-01',
  // A showtime can only exist for a room that has a bookable seat map, so the happy path seeds one.
  seats = [{ id: 1, room_id: 1, row: 'A', number: 1, seat_code: 'A1', status: 'ACTIVE' }],
} = {}) {
  await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Cinema A', code: 'A' });
  await Movie.create({ id: 1, name: 'A', premiere_date, status: movieStatus });
  await Room.create({ id: 1, cinema_id: 1, name: 'Room 1', status: roomStatus });
  if (seats.length > 0) await Seat.create(seats);
}

describe('schedule.controller list', () => {
  it('scopes to the accessible cinemas for BRANCH scope', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'Not mine', code: 'B' },
    ]);
    await Schedule.create([
      { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
      { id: 2, movie_id: 1, room_id: 2, cinema_id: 2, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
    ]);
    const res = mockRes();
    await scheduleController.list({ query: {}, account: { accountId: 42 }, permissionScope: 'BRANCH' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('returns everything for ALL scope', async () => {
    await Branch.create([{ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' }]);
    await Schedule.create([
      { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
    ]);
    const res = mockRes();
    await scheduleController.list({ query: {}, account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('filters by branchId for ALL scope (super admin picking a specific branch)', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
    ]);
    await Schedule.create([
      { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
      { id: 2, movie_id: 1, room_id: 2, cinema_id: 2, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
    ]);
    const res = mockRes();
    await scheduleController.list({ query: { branchId: '2' }, account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1, data: [expect.objectContaining({ cinema_id: 2 })] }));
  });
});

describe('schedule.controller getById', () => {
  it('returns 404 for an unknown schedule', async () => {
    const res = mockRes();
    await scheduleController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the matching schedule', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = mockRes();
    await scheduleController.getById({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe('schedule.controller create', () => {
  const baseReq = (overrides = {}) => ({
    account: { accountId: 42 },
    permissionScope: 'ALL',
    branchId: 1,
    ...overrides,
    body: {
      movie_id: 1,
      room_id: 1,
      movie_date: '2026-01-10',
      time_begin: '10:00',
      time_end: '12:00',
      price: '5000',
      ...overrides.body,
    },
  });

  it('rejects missing required fields', async () => {
    const res = mockRes();
    await scheduleController.create({ body: { movie_id: 1 }, account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects time_begin >= time_end', async () => {
    await seedMovieAndRoom();
    const res = mockRes();
    await scheduleController.create(baseReq({ body: { time_begin: '12:00', time_end: '10:00' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an unknown movie', async () => {
    await seedMovieAndRoom();
    const res = mockRes();
    await scheduleController.create(baseReq({ body: { movie_id: 999 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects an INACTIVE movie', async () => {
    await seedMovieAndRoom({ movieStatus: 'INACTIVE' });
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MOVIE_NOT_ACTIVE' }));
  });

  it('rejects a showtime scheduled before the movie premieres', async () => {
    await seedMovieAndRoom({ premiere_date: '2026-06-01' });
    const res = mockRes();
    await scheduleController.create(baseReq({ body: { movie_date: '2026-01-10' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BEFORE_PREMIERE' }));
  });

  it('rejects an unknown room', async () => {
    await seedMovieAndRoom();
    const res = mockRes();
    await scheduleController.create(baseReq({ body: { room_id: 999 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects a MAINTENANCE room', async () => {
    await seedMovieAndRoom({ roomStatus: 'MAINTENANCE' });
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROOM_NOT_ACTIVE' }));
  });

  // Ticket generation is a separate call the client makes after this one, so creating a
  // showtime for a seatless room used to leave behind a persisted showtime with no tickets —
  // a "ghost" showtime the booking page renders as an empty seat map.
  it('rejects a room with no seat map, without persisting the showtime', async () => {
    await seedMovieAndRoom({ seats: [] });
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROOM_HAS_NO_SEAT_MAP' }));
    expect(await Schedule.countDocuments()).toBe(0);
  });

  it('rejects a room whose seats are all DISABLED', async () => {
    await seedMovieAndRoom({
      seats: [{ id: 1, room_id: 1, row: 'A', number: 1, seat_code: 'A1', status: 'DISABLED' }],
    });
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROOM_HAS_NO_SEAT_MAP' }));
    expect(await Schedule.countDocuments()).toBe(0);
  });

  it('rejects a CLOSED room', async () => {
    await seedMovieAndRoom({ roomStatus: 'CLOSED' });
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROOM_NOT_ACTIVE' }));
  });

  it('rejects a room outside the caller\'s BRANCH scope', async () => {
    await seedMovieAndRoom();
    const res = mockRes();
    await scheduleController.create(baseReq({ permissionScope: 'BRANCH', branchId: 999 }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects an overlapping showtime in the same room', async () => {
    await seedMovieAndRoom();
    await Schedule.create({ id: 5, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '09:00', time_end: '11:00', price: 1 });
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCHEDULE_OVERLAP' }));
  });

  it('creates a schedule and stamps cinema_id from the room', async () => {
    await seedMovieAndRoom();
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Schedule.findOne({});
    expect(created.movie_id).toBe(1);
    expect(created.room_id).toBe(1);
    expect(created.cinema_id).toBe(1);
    expect(created.price).toBe(5000);
    expect(created.status).toBe('ACTIVE');
  });

  it('lets the same movie be scheduled at a second, unrelated branch (Movie Catalog is company-wide, not branch-owned)', async () => {
    await seedMovieAndRoom();
    await Branch.create({ id: 2, company_id: 1, owner_id: 99, name: 'Cinema B', code: 'B' });
    await Room.create({ id: 2, cinema_id: 2, name: 'Room 1', status: 'ACTIVE' });
    await Seat.create({ id: 2, room_id: 2, row: 'A', number: 1, seat_code: 'A1', status: 'ACTIVE' });

    const firstBranch = mockRes();
    await scheduleController.create(baseReq(), firstBranch);
    expect(firstBranch.status).toHaveBeenCalledWith(201);

    const secondBranch = mockRes();
    await scheduleController.create(baseReq({ body: { room_id: 2 } }), secondBranch);
    expect(secondBranch.status).toHaveBeenCalledWith(201);

    const schedules = await Schedule.find({ movie_id: 1 });
    expect(schedules.map((s) => s.cinema_id).sort()).toEqual([1, 2]);
  });
});

describe('schedule.controller update', () => {
  it('returns 404 for an unknown schedule', async () => {
    const res = mockRes();
    await scheduleController.update({ params: { id: 999 }, body: {}, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects editing a cancelled showtime', async () => {
    await seedMovieAndRoom();
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1, status: 'CANCELLED' });
    const res = mockRes();
    await scheduleController.update({ params: { id: 1 }, body: { price: 2000 }, permissionScope: 'ALL', branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCHEDULE_CANCELLED' }));
  });

  it('rejects an update that would overlap another showtime in the room', async () => {
    await seedMovieAndRoom();
    await Schedule.create([
      { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 },
      { id: 2, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '14:00', time_end: '16:00', price: 1 },
    ]);
    const res = mockRes();
    await scheduleController.update({ params: { id: 2 }, body: { time_begin: '11:00', time_end: '13:00' }, permissionScope: 'ALL', branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('updates price without touching other fields', async () => {
    await seedMovieAndRoom();
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1000 });
    const res = mockRes();
    await scheduleController.update({ params: { id: 1 }, body: { price: 2500 }, permissionScope: 'ALL', branchId: 1 }, res);
    const updated = await Schedule.findOne({ id: 1 });
    expect(updated.price).toBe(2500);
    expect(updated.time_begin).toBe('10:00');
  });
});

describe('schedule.controller cancel', () => {
  it('returns 404 for an unknown schedule', async () => {
    const res = mockRes();
    await scheduleController.cancel({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects cancelling an already-cancelled showtime', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1, status: 'CANCELLED' });
    const res = mockRes();
    await scheduleController.cancel({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('marks an active showtime as cancelled', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = mockRes();
    await scheduleController.cancel({ params: { id: 1 } }, res);
    const updated = await Schedule.findOne({ id: 1 });
    expect(updated.status).toBe('CANCELLED');
  });
});

describe('schedule.controller remove', () => {
  it('returns 404 for an unknown schedule', async () => {
    const res = mockRes();
    await scheduleController.remove({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes the schedule', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = mockRes();
    await scheduleController.remove({ params: { id: 1 } }, res);
    expect(await Schedule.countDocuments()).toBe(0);
  });
});
