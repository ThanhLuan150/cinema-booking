const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const ticketController = require('./ticket.controller');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
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

describe('ticket.controller create', () => {
  it('rejects a missing schedule_id', async () => {
    const res = mockRes();
    await ticketController.create({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns existing tickets if the schedule was already generated', async () => {
    await Ticket.create({ id: 1, schedule_id: 5, seat_index: 0, seat_code: 'A1' });
    const res = mockRes();
    await ticketController.create({ body: { schedule_id: 5 } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ seat_code: 'A1' })]);
  });

  it('returns 404 when the schedule does not exist', async () => {
    const res = mockRes();
    await ticketController.create({ body: { schedule_id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects when the room has no seat map', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = mockRes();
    await ticketController.create({ body: { schedule_id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('generates tickets from the room\'s seat map, skipping locked seats', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Seat.create([
      { id: 1, room_id: 1, seat_code: 'A1', seat_type: 0, is_locked: false },
      { id: 2, room_id: 1, seat_code: 'A2', seat_type: 0, is_locked: true },
      { id: 3, room_id: 1, seat_code: 'A3', seat_type: 1, is_locked: false },
    ]);
    const res = mockRes();
    await ticketController.create({ body: { schedule_id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const tickets = await Ticket.find({ schedule_id: 1 }).sort({ seat_index: 1 });
    expect(tickets).toHaveLength(2);
    expect(tickets.map((t) => t.seat_code)).toEqual(['A1', 'A3']);
    expect(tickets.map((t) => t.seat_index)).toEqual([0, 1]);
  });
});

describe('ticket.controller markSold', () => {
  it('returns 404 for an unknown ticket', async () => {
    const res = mockRes();
    await ticketController.markSold({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('marks the ticket sold', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
    const res = mockRes();
    await ticketController.markSold({ params: { id: 1 } }, res);
    expect((await Ticket.findOne({ id: 1 })).status).toBe(0);
  });
});
