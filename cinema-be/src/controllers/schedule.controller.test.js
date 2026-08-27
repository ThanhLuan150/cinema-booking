jest.mock('../utils/socket', () => ({ emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitToAccount: jest.fn(), emitPublic: jest.fn() }));
jest.mock('../utils/mailer', () => ({
  sendShowtimeCancelledEmail: jest.fn().mockResolvedValue({}),
  sendShowtimeRescheduledEmail: jest.fn().mockResolvedValue({}),
}));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const scheduleController = require('./schedule.controller');
const socket = require('../utils/socket');
const mailer = require('../utils/mailer');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const Movie = require('../models/Movie');
const Seat = require('../models/Seat');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
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

  it('filters by movieId — used by Customer Service to find another showtime for the same movie', async () => {
    await Branch.create([{ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' }]);
    await Schedule.create([
      { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
      { id: 2, movie_id: 2, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '14:00', time_end: '16:00', price: 1 },
    ]);
    const res = mockRes();
    await scheduleController.list({ query: { movieId: '2' }, account: { accountId: 1 }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1, data: [expect.objectContaining({ id: 2 })] }));
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

  it('rejects a showtime that starts too soon after another one ends in the same room', async () => {
    await seedMovieAndRoom();
    await Schedule.create({ id: 5, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '08:00', time_end: '09:55', price: 1 });
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCHEDULE_BUFFER_TOO_SHORT' }));
  });

  it('allows a showtime with at least the required buffer after the previous one ends', async () => {
    await seedMovieAndRoom();
    await Schedule.create({ id: 5, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '08:00', time_end: '09:45', price: 1 });
    const res = mockRes();
    await scheduleController.create(baseReq(), res);
    expect(res.status).toHaveBeenCalledWith(201);
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

  it('cancels a PENDING booking on the showtime and releases its seats, without touching any Payment', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Cinema A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'Room 1' });
    await Movie.create({ id: 1, name: 'A', premiere_date: '2020-01-01', status: 'ACTIVE' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 10, held_until: new Date(Date.now() + 60000) });
    await Booking.create({ id: 1, code: 'BK-1', account_id: 10, schedule_id: 1, branch_id: 1, ticket_ids: [1], total_price: 1, status: 'PENDING' });

    const res = mockRes();
    await scheduleController.cancel({ params: { id: 1 }, account: { accountId: 42 }, body: {} }, res);

    expect((await Booking.findOne({ id: 1 })).status).toBe('CANCELLED');
    expect((await Ticket.findOne({ id: 1 })).status).toBe(1);
    expect(await Payment.findOne({ code: 'BK-1' })).toBeNull();
  });

  it('cancels a PAID booking, releases its seats and requests a refund without completing it', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Cinema A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'Room 1' });
    await Movie.create({ id: 1, name: 'A', premiere_date: '2020-01-01', status: 'ACTIVE' });
    await Account.create({ id: 10, email: 'buyer@example.com', password: 'x' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
    await Booking.create({ id: 1, code: 'BK-2', account_id: 10, schedule_id: 1, branch_id: 1, ticket_ids: [1], total_price: 1, status: 'PAID' });
    await Invoice.create({ id: 1, booking_id: 1, ticket_id: 1, account_id: 10, code: 'BK-2', total_price: 1, status: 1 });
    await Payment.create({ id: 1, code: 'BK-2', booking_id: 1, account_id: 10, type: 'ONLINE', method: 'MOMO', amount: 1, status: 'PAID' });

    const res = mockRes();
    await scheduleController.cancel({ params: { id: 1 }, account: { accountId: 42 }, body: {} }, res);

    expect((await Booking.findOne({ id: 1 })).status).toBe('CANCELLED');
    expect((await Ticket.findOne({ id: 1 })).status).toBe(1);
    const payment = await Payment.findOne({ id: 1 });
    expect(payment.status).toBe('REFUND_PENDING');

    expect(mailer.sendShowtimeCancelledEmail).toHaveBeenCalledWith('buyer@example.com', expect.objectContaining({ movieName: 'A' }));
    expect(socket.emitToAccount).toHaveBeenCalledWith(10, 'showtime:cancelled', expect.objectContaining({ bookingId: 1, refundRequested: true }));

    const logs = await AuditLog.find().sort({ id: 1 });
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining(['BOOKING_REFUND_REQUESTED', 'CANCEL_SHOWTIME']),
    );
  });
});

describe('schedule.controller reschedule', () => {
  const rescheduleReq = (overrides = {}) => ({
    params: { id: 1 },
    account: { accountId: 42 },
    permissionScope: 'ALL',
    branchId: 1,
    body: { movie_date: '2026-01-10', time_begin: '14:00', time_end: '16:00' },
    ...overrides,
  });

  it('returns 404 for an unknown schedule', async () => {
    const res = mockRes();
    await scheduleController.reschedule(rescheduleReq({ params: { id: 999 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects rescheduling a cancelled showtime', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1, status: 'CANCELLED' });
    const res = mockRes();
    await scheduleController.reschedule(rescheduleReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCHEDULE_CANCELLED' }));
  });

  it('rejects a no-op reschedule (identical date/time)', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = mockRes();
    await scheduleController.reschedule(rescheduleReq({ body: { movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_CHANGE' }));
  });

  it('rejects a new time that overlaps another showtime in the same room', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Cinema A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'Room 1' });
    await Movie.create({ id: 1, name: 'A', premiere_date: '2020-01-01', status: 'ACTIVE' });
    await Seat.create({ id: 1, room_id: 1, row: 'A', number: 1, seat_code: 'A1', status: 'ACTIVE' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Schedule.create({ id: 2, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '14:00', time_end: '16:00', price: 1 });

    const res = mockRes();
    await scheduleController.reschedule(rescheduleReq(), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('updates the showtime and flags every PAID booking for a reschedule decision, leaving PENDING alone', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Cinema A', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'Room 1' });
    await Movie.create({ id: 1, name: 'A', premiere_date: '2020-01-01', status: 'ACTIVE' });
    await Seat.create({ id: 1, room_id: 1, row: 'A', number: 1, seat_code: 'A1', status: 'ACTIVE' });
    await Account.create({ id: 10, email: 'paid@example.com', password: 'x' });
    await Account.create({ id: 11, email: 'pending@example.com', password: 'x' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-10', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Booking.create({ id: 1, code: 'BK-1', account_id: 10, schedule_id: 1, branch_id: 1, total_price: 1, status: 'PAID' });
    await Booking.create({ id: 2, code: 'BK-2', account_id: 11, schedule_id: 1, branch_id: 1, total_price: 1, status: 'PENDING' });

    const res = mockRes();
    await scheduleController.reschedule(rescheduleReq(), res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    const updated = await Schedule.findOne({ id: 1 });
    expect(updated.time_begin).toBe('14:00');

    expect((await Booking.findOne({ id: 1 })).needs_reschedule_response).toBe(true);
    expect((await Booking.findOne({ id: 2 })).needs_reschedule_response).toBe(false);
    expect((await Booking.findOne({ id: 2 })).status).toBe('PENDING');

    expect(mailer.sendShowtimeRescheduledEmail).toHaveBeenCalledWith('paid@example.com', expect.objectContaining({ oldTime: '10:00', newTime: '14:00' }));
    expect(mailer.sendShowtimeRescheduledEmail).not.toHaveBeenCalledWith('pending@example.com', expect.anything());
    expect(socket.emitToAccount).toHaveBeenCalledWith(10, 'showtime:rescheduled', expect.objectContaining({ bookingId: 1 }));

    const logs = await AuditLog.find().sort({ id: 1 });
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining(['BOOKING_RESCHEDULE_NOTIFIED', 'SCHEDULE_RESCHEDULED']),
    );
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
