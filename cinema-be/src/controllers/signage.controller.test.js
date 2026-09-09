const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const signageController = require('./signage.controller');
const Screen = require('../models/Screen');
const SignageContent = require('../models/SignageContent');
const SignageSchedule = require('../models/SignageSchedule');
const Schedule = require('../models/Schedule');
const Movie = require('../models/Movie');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('signage.controller — screens', () => {
  it('rejects a screen with no name', async () => {
    const res = mockRes();
    await signageController.createScreen({ body: {}, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a screen on the caller-scoped branch and returns the api_key once', async () => {
    const res = mockRes();
    await signageController.createScreen({ body: { name: 'Lobby', location: 'North wall' }, branchId: 7 }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const created = res.json.mock.calls[0][0];
    expect(created.branch_id).toBe(7);
    expect(created.status).toBe('ACTIVE');
    expect(created.api_key).toMatch(/^SCR-/);
    expect(created.api_key_hash).toBeUndefined();
  });

  it('rotates a screen key and returns a fresh one', async () => {
    await Screen.create({ id: 1, branch_id: 1, name: 'A', api_key_hash: 'old' });
    const res = mockRes();
    await signageController.rotateScreenKey({ params: { id: 1 } }, res);
    const body = res.json.mock.calls[0][0];
    expect(body.api_key).toMatch(/^SCR-/);
    const reloaded = await Screen.findOne({ id: 1 });
    expect(reloaded.api_key_hash).not.toBe('old');
  });

  it('rejects a duplicate device_id', async () => {
    await Screen.create({ id: 1, branch_id: 1, name: 'A', device_id: 'PLAYER-1' });
    const res = mockRes();
    await signageController.createScreen({ body: { name: 'B', device_id: 'PLAYER-1' }, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCREEN_DEVICE_ID_TAKEN' }));
  });

  it('refuses to delete a screen that still has playlist entries', async () => {
    await Screen.create({ id: 1, branch_id: 1, name: 'A' });
    await SignageSchedule.create({
      id: 1,
      content_id: 1,
      screen_id: 1,
      start_at: new Date(),
      end_at: new Date(Date.now() + 1000),
    });
    const res = mockRes();
    await signageController.removeScreen({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCREEN_HAS_SCHEDULES' }));
  });
});

describe('signage.controller — content', () => {
  it('rejects an unknown content type', async () => {
    const res = mockRes();
    await signageController.createContent({ body: { type: 'GIF', title: 'x' }, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TYPE' }));
  });

  it('requires movie_id for a MOVIE_POSTER', async () => {
    const res = mockRes();
    await signageController.createContent({ body: { type: 'MOVIE_POSTER', title: 'x' }, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MOVIE_ID_REQUIRED' }));
  });

  it('rejects a SHOWTIME whose schedule belongs to another branch', async () => {
    await Schedule.create({
      id: 500,
      movie_id: 1,
      room_id: 1,
      cinema_id: 99,
      movie_date: '2026-06-20',
      time_begin: '18:00',
      time_end: '20:00',
      price: 100,
      status: 'ACTIVE',
    });
    const res = mockRes();
    await signageController.createContent({ body: { type: 'SHOWTIME', title: 'Tonight', schedule_id: 500 }, branchId: 10 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SHOWTIME_BRANCH_MISMATCH' }));
  });

  it('rejects a SHOWTIME whose schedule is already cancelled', async () => {
    await Schedule.create({
      id: 500,
      movie_id: 1,
      room_id: 1,
      cinema_id: 10,
      movie_date: '2026-06-20',
      time_begin: '18:00',
      time_end: '20:00',
      price: 100,
      status: 'CANCELLED',
    });
    const res = mockRes();
    await signageController.createContent({ body: { type: 'SHOWTIME', title: 'Tonight', schedule_id: 500 }, branchId: 10 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SHOWTIME_CANCELLED' }));
  });

  it('creates a SHOWTIME item and copies the movie_id off the schedule', async () => {
    await Movie.create({ id: 3, name: 'Dune', premiere_date: '2026-01-01' });
    await Schedule.create({
      id: 500,
      movie_id: 3,
      room_id: 1,
      cinema_id: 10,
      movie_date: '2026-06-20',
      time_begin: '18:00',
      time_end: '20:00',
      price: 100,
      status: 'ACTIVE',
    });
    const res = mockRes();
    await signageController.createContent({ body: { type: 'SHOWTIME', title: 'Tonight', schedule_id: 500 }, branchId: 10 }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0]).toMatchObject({ schedule_id: 500, movie_id: 3, branch_id: 10 });
  });
});

describe('signage.controller — schedules (playlist entries)', () => {
  async function seedSameBranch() {
    await Screen.create({ id: 1, branch_id: 10, name: 'Lobby' });
    await SignageContent.create({ id: 100, branch_id: 10, type: 'ANNOUNCEMENT', title: 'Hi' });
  }

  it('rejects linking content and screen from different branches', async () => {
    await Screen.create({ id: 1, branch_id: 10, name: 'Lobby' });
    await SignageContent.create({ id: 100, branch_id: 77, type: 'ANNOUNCEMENT', title: 'Hi' });
    const res = mockRes();
    await signageController.createSchedule(
      { body: { content_id: 100, screen_id: 1, start_at: '2026-01-01', end_at: '2026-02-01' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SIGNAGE_BRANCH_MISMATCH' }));
  });

  it('rejects a window whose start is after its end', async () => {
    await seedSameBranch();
    const res = mockRes();
    await signageController.createSchedule(
      { body: { content_id: 100, screen_id: 1, start_at: '2026-02-01', end_at: '2026-01-01' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_WINDOW' }));
  });

  it('creates a valid playlist entry', async () => {
    await seedSameBranch();
    const res = mockRes();
    await signageController.createSchedule(
      { body: { content_id: 100, screen_id: 1, start_at: '2026-01-01', end_at: '2026-02-01', priority: 5 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0]).toMatchObject({ content_id: 100, screen_id: 1, priority: 5, status: 'ACTIVE' });
  });
});
