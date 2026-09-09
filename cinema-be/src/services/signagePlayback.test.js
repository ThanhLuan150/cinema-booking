const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { filterPlayableEntries, resolvePlayback, DROP } = require('./signagePlayback');
const Screen = require('../models/Screen');
const SignageContent = require('../models/SignageContent');
const SignageSchedule = require('../models/SignageSchedule');
const Schedule = require('../models/Schedule');
const Movie = require('../models/Movie');

function mapOf(rows) {
  return new Map(rows.map((r) => [Number(r.id), r]));
}

describe('filterPlayableEntries (pure business rules)', () => {
  const screen = { id: 1, branch_id: 10, status: 'ACTIVE' };

  it('keeps an ACTIVE content item of the screen’s own branch', () => {
    const entries = [{ id: 1, content_id: 100, priority: 0, start_at: new Date(), end_at: new Date() }];
    const contentById = mapOf([{ id: 100, branch_id: 10, type: 'ANNOUNCEMENT', status: 'ACTIVE' }]);
    const { playable, dropped } = filterPlayableEntries({ screen, entries, contentById, scheduleById: new Map() });
    expect(playable).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it('drops content that belongs to another branch (Rule: screen shows only its branch)', () => {
    const entries = [{ id: 1, content_id: 100, priority: 0, start_at: new Date(), end_at: new Date() }];
    const contentById = mapOf([{ id: 100, branch_id: 999, type: 'ANNOUNCEMENT', status: 'ACTIVE' }]);
    const { playable, dropped } = filterPlayableEntries({ screen, entries, contentById, scheduleById: new Map() });
    expect(playable).toHaveLength(0);
    expect(dropped[0].code).toBe(DROP.CONTENT_BRANCH_MISMATCH);
  });

  it('drops INACTIVE content', () => {
    const entries = [{ id: 1, content_id: 100, priority: 0, start_at: new Date(), end_at: new Date() }];
    const contentById = mapOf([{ id: 100, branch_id: 10, type: 'ANNOUNCEMENT', status: 'INACTIVE' }]);
    const { playable, dropped } = filterPlayableEntries({ screen, entries, contentById, scheduleById: new Map() });
    expect(playable).toHaveLength(0);
    expect(dropped[0].code).toBe(DROP.CONTENT_INACTIVE);
  });

  it('drops a SHOWTIME whose Schedule belongs to another branch (Rule: no other-branch showtime)', () => {
    const entries = [{ id: 1, content_id: 100, priority: 0, start_at: new Date(), end_at: new Date() }];
    const contentById = mapOf([{ id: 100, branch_id: 10, type: 'SHOWTIME', status: 'ACTIVE', schedule_id: 500 }]);
    const scheduleById = mapOf([{ id: 500, cinema_id: 77, status: 'ACTIVE' }]);
    const { playable, dropped } = filterPlayableEntries({ screen, entries, contentById, scheduleById });
    expect(playable).toHaveLength(0);
    expect(dropped[0].code).toBe(DROP.SHOWTIME_BRANCH_MISMATCH);
  });

  it('drops a SHOWTIME whose Schedule is CANCELLED (Rule: cancelled showtime stops playing)', () => {
    const entries = [{ id: 1, content_id: 100, priority: 0, start_at: new Date(), end_at: new Date() }];
    const contentById = mapOf([{ id: 100, branch_id: 10, type: 'SHOWTIME', status: 'ACTIVE', schedule_id: 500 }]);
    const scheduleById = mapOf([{ id: 500, cinema_id: 10, status: 'CANCELLED' }]);
    const { playable, dropped } = filterPlayableEntries({ screen, entries, contentById, scheduleById });
    expect(playable).toHaveLength(0);
    expect(dropped[0].code).toBe(DROP.SHOWTIME_CANCELLED);
  });

  it('keeps a SHOWTIME whose Schedule is ACTIVE and same-branch', () => {
    const entries = [{ id: 1, content_id: 100, priority: 0, start_at: new Date(), end_at: new Date() }];
    const contentById = mapOf([{ id: 100, branch_id: 10, type: 'SHOWTIME', status: 'ACTIVE', schedule_id: 500 }]);
    const scheduleById = mapOf([{ id: 500, cinema_id: 10, status: 'ACTIVE' }]);
    const { playable } = filterPlayableEntries({ screen, entries, contentById, scheduleById });
    expect(playable).toHaveLength(1);
  });

  it('plays nothing on a screen that is not ACTIVE', () => {
    const entries = [{ id: 1, content_id: 100, priority: 0, start_at: new Date(), end_at: new Date() }];
    const contentById = mapOf([{ id: 100, branch_id: 10, type: 'ANNOUNCEMENT', status: 'ACTIVE' }]);
    const off = { id: 1, branch_id: 10, status: 'MAINTENANCE' };
    const { playable } = filterPlayableEntries({ screen: off, entries, contentById, scheduleById: new Map() });
    expect(playable).toHaveLength(0);
  });

  it('orders playable items by priority desc then start_at asc', () => {
    const entries = [
      { id: 1, content_id: 100, priority: 1, start_at: new Date('2026-01-02') },
      { id: 2, content_id: 101, priority: 5, start_at: new Date('2026-01-05') },
      { id: 3, content_id: 102, priority: 5, start_at: new Date('2026-01-01') },
    ];
    const contentById = mapOf([
      { id: 100, branch_id: 10, type: 'ANNOUNCEMENT', status: 'ACTIVE' },
      { id: 101, branch_id: 10, type: 'ANNOUNCEMENT', status: 'ACTIVE' },
      { id: 102, branch_id: 10, type: 'ANNOUNCEMENT', status: 'ACTIVE' },
    ]);
    const { playable } = filterPlayableEntries({ screen, entries, contentById, scheduleById: new Map() });
    expect(playable.map((p) => p.entry.id)).toEqual([3, 2, 1]);
  });
});

describe('resolvePlayback (DB-backed)', () => {
  beforeAll(async () => connect());
  afterEach(async () => clearDatabase());
  afterAll(async () => closeDatabase());

  const now = new Date('2026-06-15T12:00:00Z');
  const inWindow = { start_at: new Date('2026-06-01T00:00:00Z'), end_at: new Date('2026-07-01T00:00:00Z') };

  async function seedScreen(overrides = {}) {
    return Screen.create({ id: 1, branch_id: 10, name: 'Lobby', status: 'ACTIVE', ...overrides });
  }

  it('returns null for an unknown screen', async () => {
    expect(await resolvePlayback(999, { now })).toBeNull();
  });

  it('excludes a playlist entry whose window does not cover now', async () => {
    await seedScreen();
    await SignageContent.create({ id: 100, branch_id: 10, type: 'ANNOUNCEMENT', title: 'Hi', status: 'ACTIVE' });
    await SignageSchedule.create({
      id: 1,
      content_id: 100,
      screen_id: 1,
      start_at: new Date('2026-01-01T00:00:00Z'),
      end_at: new Date('2026-02-01T00:00:00Z'),
      status: 'ACTIVE',
    });
    const result = await resolvePlayback(1, { now });
    expect(result.items).toHaveLength(0);
  });

  it('drops a SHOWTIME item when its Schedule is later cancelled', async () => {
    await seedScreen();
    await Movie.create({ id: 5, name: 'Dune', premiere_date: '2026-01-01' });
    await Schedule.create({
      id: 500,
      movie_id: 5,
      room_id: 1,
      cinema_id: 10,
      movie_date: '2026-06-20',
      time_begin: '18:00',
      time_end: '20:00',
      price: 100,
      status: 'CANCELLED',
    });
    await SignageContent.create({ id: 100, branch_id: 10, type: 'SHOWTIME', title: 'Tonight', schedule_id: 500, movie_id: 5, status: 'ACTIVE' });
    await SignageSchedule.create({ id: 1, content_id: 100, screen_id: 1, ...inWindow, status: 'ACTIVE' });

    const result = await resolvePlayback(1, { now });
    expect(result.items).toHaveLength(0);
    expect(result.dropped.map((d) => d.code)).toContain(DROP.SHOWTIME_CANCELLED);
  });

  it('serves an active same-branch item and decorates it with movie detail', async () => {
    await seedScreen();
    await Movie.create({ id: 5, name: 'Dune', premiere_date: '2026-01-01', avatar: 'poster.jpg' });
    await SignageContent.create({ id: 100, branch_id: 10, type: 'MOVIE_POSTER', title: 'Now showing', movie_id: 5, status: 'ACTIVE' });
    await SignageSchedule.create({ id: 1, content_id: 100, screen_id: 1, ...inWindow, priority: 3, status: 'ACTIVE' });

    const result = await resolvePlayback(1, { now });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ type: 'MOVIE_POSTER', title: 'Now showing' });
    expect(result.items[0].movie).toMatchObject({ id: 5, name: 'Dune' });
    expect(result.items[0].image_url).toBe('poster.jpg');
  });

  it('never serves content that belongs to another branch', async () => {
    await seedScreen();
    await SignageContent.create({ id: 100, branch_id: 77, type: 'ANNOUNCEMENT', title: 'Other branch', status: 'ACTIVE' });
    await SignageSchedule.create({ id: 1, content_id: 100, screen_id: 1, ...inWindow, status: 'ACTIVE' });

    const result = await resolvePlayback(1, { now });
    expect(result.items).toHaveLength(0);
    expect(result.dropped.map((d) => d.code)).toContain(DROP.CONTENT_BRANCH_MISMATCH);
  });
});
