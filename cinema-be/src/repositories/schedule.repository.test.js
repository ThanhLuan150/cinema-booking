const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const scheduleRepository = require('./schedule.repository');
const Schedule = require('../models/Schedule');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedShowtimes() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 100, name: 'Cinema A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 200, name: 'Cinema B', code: 'B' },
  ]);
  await Schedule.create([
    { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1000 },
    { id: 2, movie_id: 1, room_id: 2, cinema_id: 2, movie_date: '2026-01-01', time_begin: '14:00', time_end: '16:00', price: 1000 },
  ]);
}

describe('schedule.repository', () => {
  describe('resolveAccessibleCinemaIds', () => {
    it('includes cinemas the account owns', async () => {
      await seedShowtimes();
      const ids = await scheduleRepository.resolveAccessibleCinemaIds(100);
      expect(ids).toEqual([1]);
    });

    it('includes the cinema the account is actively staffed at', async () => {
      await seedShowtimes();
      await Employee.create({ id: 1, user_id: 7, branch_id: 2, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      const ids = await scheduleRepository.resolveAccessibleCinemaIds(7);
      expect(ids).toEqual([2]);
    });

    it('returns an empty list for an account with no cinema and no active staff record', async () => {
      await seedShowtimes();
      const ids = await scheduleRepository.resolveAccessibleCinemaIds(999);
      expect(ids).toEqual([]);
    });
  });

  describe('findFiltered', () => {
    it('returns everything for ALL scope with no filters', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ scope: 'ALL' });
      expect(result.total).toBe(2);
    });

    it('scopes results to a room id when provided', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ scope: 'ALL', roomId: 1 });
      expect(result.total).toBe(1);
      expect(result.data[0].room_id).toBe(1);
    });

    it('scopes BRANCH scope to only the accessible cinema ids', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ scope: 'BRANCH', accessibleCinemaIds: [1] });
      expect(result.total).toBe(1);
      expect(result.data[0].room_id).toBe(1);
    });

    it('scopes by cinemaId for ALL scope', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ scope: 'ALL', cinemaId: 2 });
      expect(result.total).toBe(1);
      expect(result.data[0].room_id).toBe(2);
    });

    it('returns nothing for BRANCH scope with no accessible cinemas', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ scope: 'BRANCH', accessibleCinemaIds: [] });
      expect(result.total).toBe(0);
    });

    it('ignores a cinemaId outside the accessible cinema ids under BRANCH scope', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({
        scope: 'BRANCH',
        accessibleCinemaIds: [1],
        cinemaId: 2,
      });
      expect(result.total).toBe(0);
    });
  });

  it('findById returns the matching schedule', async () => {
    await seedShowtimes();
    const schedule = await scheduleRepository.findById(1);
    expect(schedule.movie_date).toBe('2026-01-01');
  });

  it('findCinemaIdByScheduleId resolves the schedule\'s branch', async () => {
    await seedShowtimes();
    expect(await scheduleRepository.findCinemaIdByScheduleId(2)).toBe(2);
  });

  describe('existsActiveByRoomId', () => {
    it('is true when the room has a non-cancelled showtime', async () => {
      await seedShowtimes();
      expect(await scheduleRepository.existsActiveByRoomId(1)).toBe(true);
    });

    it('is false when the room has no showtimes', async () => {
      await seedShowtimes();
      expect(await scheduleRepository.existsActiveByRoomId(999)).toBe(false);
    });

    it('is false when the room\'s only showtimes are cancelled', async () => {
      await Schedule.create({
        id: 5,
        movie_id: 1,
        room_id: 3,
        cinema_id: 1,
        movie_date: '2026-03-01',
        time_begin: '10:00',
        time_end: '12:00',
        price: 1,
        status: 'CANCELLED',
      });
      expect(await scheduleRepository.existsActiveByRoomId(3)).toBe(false);
    });
  });

  describe('findOverlapping', () => {
    it('detects an overlapping time range in the same room', async () => {
      await seedShowtimes();
      const overlap = await scheduleRepository.findOverlapping({
        room_id: 1,
        movie_date: '2026-01-01',
        time_begin: '11:00',
        time_end: '13:00',
      });
      expect(overlap).not.toBeNull();
    });

    it('does not flag a non-overlapping time range', async () => {
      await seedShowtimes();
      const overlap = await scheduleRepository.findOverlapping({
        room_id: 1,
        movie_date: '2026-01-01',
        time_begin: '12:00',
        time_end: '13:00',
      });
      expect(overlap).toBeNull();
    });

    it('excludes the schedule being edited', async () => {
      await seedShowtimes();
      const overlap = await scheduleRepository.findOverlapping({
        room_id: 1,
        movie_date: '2026-01-01',
        time_begin: '10:00',
        time_end: '12:00',
        excludeId: 1,
      });
      expect(overlap).toBeNull();
    });

    it('ignores a cancelled schedule in the same slot', async () => {
      await Schedule.create({
        id: 5,
        movie_id: 1,
        room_id: 1,
        cinema_id: 1,
        movie_date: '2026-03-01',
        time_begin: '10:00',
        time_end: '12:00',
        price: 1,
        status: 'CANCELLED',
      });
      const overlap = await scheduleRepository.findOverlapping({
        room_id: 1,
        movie_date: '2026-03-01',
        time_begin: '10:00',
        time_end: '12:00',
      });
      expect(overlap).toBeNull();
    });
  });

  it('create persists a new schedule', async () => {
    const schedule = await scheduleRepository.create({
      id: 10,
      movie_id: 1,
      room_id: 1,
      cinema_id: 1,
      movie_date: '2026-02-01',
      time_begin: '09:00',
      time_end: '11:00',
      price: 5000,
      status: 'ACTIVE',
    });
    expect(schedule.id).toBe(10);
  });
});
