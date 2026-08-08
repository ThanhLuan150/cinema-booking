const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const scheduleRepository = require('./schedule.repository');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Cinema = require('../models/Cinema');
const Employee = require('../models/Employee');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedShowtimes() {
  await Cinema.create([
    { id: 1, owner_id: 100, name: 'Cinema A' },
    { id: 2, owner_id: 200, name: 'Cinema B' },
  ]);
  await Room.create([
    { id: 1, cinema_id: 1, name: 'Room 1' },
    { id: 2, cinema_id: 2, name: 'Room 2' },
  ]);
  await Schedule.create([
    { id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1000 },
    { id: 2, movie_id: 1, room_id: 2, movie_date: '2026-01-01', time_begin: '14:00', time_end: '16:00', price: 1000 },
  ]);
}

describe('schedule.repository', () => {
  describe('findFiltered', () => {
    it('returns everything for an admin with no filters', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ role: 0, accountId: 999 });
      expect(result.total).toBe(2);
    });

    it('scopes results to a room id when provided', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ role: 0, accountId: 999, roomId: 1 });
      expect(result.total).toBe(1);
      expect(result.data[0].room_id).toBe(1);
    });

    it('scopes a theater owner (role 2) to only their own cinema\'s rooms', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ role: 2, accountId: 100 });
      expect(result.total).toBe(1);
      expect(result.data[0].room_id).toBe(1);
    });

    it('scopes by cinemaId for a non-owner role', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ role: 1, accountId: 1, cinemaId: 2 });
      expect(result.total).toBe(1);
      expect(result.data[0].room_id).toBe(2);
    });

    it('scopes an employee (role 3) to only their staffed cinema\'s rooms', async () => {
      await seedShowtimes();
      await Employee.create({ id: 1, account_id: 7, cinema_id: 2, status: 1 });
      const result = await scheduleRepository.findFiltered({ role: 3, accountId: 7 });
      expect(result.total).toBe(1);
      expect(result.data[0].room_id).toBe(2);
    });

    it('returns nothing for an employee with no active staff record', async () => {
      await seedShowtimes();
      const result = await scheduleRepository.findFiltered({ role: 3, accountId: 7 });
      expect(result.total).toBe(0);
    });
  });

  it('findById returns the matching schedule', async () => {
    await seedShowtimes();
    const schedule = await scheduleRepository.findById(1);
    expect(schedule.movie_date).toBe('2026-01-01');
  });

  it('create persists a new schedule', async () => {
    const schedule = await scheduleRepository.create({
      id: 10,
      movie_id: 1,
      room_id: 1,
      movie_date: '2026-02-01',
      time_begin: '09:00',
      time_end: '11:00',
      price: 5000,
    });
    expect(schedule.id).toBe(10);
  });
});
