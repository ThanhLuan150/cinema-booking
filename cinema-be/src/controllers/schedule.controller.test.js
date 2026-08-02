const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const scheduleController = require('./schedule.controller');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Cinema = require('../models/Cinema');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('schedule.controller list', () => {
  it('scopes to an owner\'s cinemas for role 2', async () => {
    await Cinema.create([
      { id: 1, owner_id: 42, name: 'Mine' },
      { id: 2, owner_id: 99, name: 'Not mine' },
    ]);
    await Room.create([
      { id: 1, cinema_id: 1, name: 'R1' },
      { id: 2, cinema_id: 2, name: 'R2' },
    ]);
    await Schedule.create([
      { id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
      { id: 2, movie_id: 1, room_id: 2, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
    ]);
    const res = mockRes();
    await scheduleController.list({ query: {}, account: { role: 2, accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });
});

describe('schedule.controller getById', () => {
  it('returns 404 for an unknown schedule', async () => {
    const res = mockRes();
    await scheduleController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the matching schedule', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = mockRes();
    await scheduleController.getById({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe('schedule.controller create', () => {
  it('rejects missing required fields', async () => {
    const res = mockRes();
    await scheduleController.create({ body: { movie_id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a schedule with normalized numeric fields', async () => {
    const res = mockRes();
    await scheduleController.create(
      { body: { movie_id: '1', room_id: '2', movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: '5000' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Schedule.findOne({});
    expect(created.movie_id).toBe(1);
    expect(created.room_id).toBe(2);
    expect(created.price).toBe(5000);
  });
});
