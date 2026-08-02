const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const ticketRepository = require('./ticket.repository');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Seat = require('../models/Seat');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('ticket.repository', () => {
  it('countByScheduleId counts tickets for a schedule', async () => {
    await Ticket.create([
      { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' },
      { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2' },
      { id: 3, schedule_id: 2, seat_index: 0, seat_code: 'A1' },
    ]);
    expect(await ticketRepository.countByScheduleId(1)).toBe(2);
  });

  it('findByScheduleId sorts by seat_index', async () => {
    await Ticket.create([
      { id: 1, schedule_id: 1, seat_index: 1, seat_code: 'A2' },
      { id: 2, schedule_id: 1, seat_index: 0, seat_code: 'A1' },
    ]);
    const result = await ticketRepository.findByScheduleId(1);
    expect(result.map((t) => t.seat_index)).toEqual([0, 1]);
  });

  it('findScheduleById returns the matching schedule', async () => {
    await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price: 1000,
    });
    const schedule = await ticketRepository.findScheduleById(1);
    expect(schedule).not.toBeNull();
  });

  it('findSeatMapByRoomId returns seats for a room, sorted by id', async () => {
    await Seat.create([
      { id: 2, room_id: 1, seat_code: 'A2' },
      { id: 1, room_id: 1, seat_code: 'A1' },
    ]);
    const result = await ticketRepository.findSeatMapByRoomId(1);
    expect(result.map((s) => s.id)).toEqual([1, 2]);
  });

  it('insertMany bulk-creates tickets', async () => {
    await ticketRepository.insertMany([
      { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' },
      { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2' },
    ]);
    expect(await Ticket.countDocuments()).toBe(2);
  });

  it('markSold sets the ticket status to sold (0)', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
    const updated = await ticketRepository.markSold(1);
    expect(updated.status).toBe(0);
  });
});
