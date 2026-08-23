const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const bookingController = require('./booking.controller');
const Invoice = require('../models/Invoice');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const Movie = require('../models/Movie');
const Account = require('../models/Account');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function dateAt(hoursFromNow) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const movie_date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time_begin = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { movie_date, time_begin };
}

beforeAll(async () => connect());
let logSpy;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(async () => {
  await clearDatabase();
  logSpy.mockRestore();
});
afterAll(async () => closeDatabase());

describe('POST /api/scheduleId', () => {
  it('returns 404 when no matching schedule exists', async () => {
    const res = mockRes();
    await bookingController.resolveScheduleId(
      { body: { movie_id: 1, movie_date: '2026-01-01', time_begin: '10:00' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the schedule id for an exact match', async () => {
    await Schedule.create({ id: 7, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    const res = mockRes();
    await bookingController.resolveScheduleId(
      { body: { movie_id: 1, movie_date: '2026-01-01', time_begin: '10:00' } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith({ id: 7 });
  });
});

describe('GET /api/bookseat/:scheduleId', () => {
  it('returns tickets for the schedule', async () => {
    await Ticket.create({ id: 1, schedule_id: 5, seat_index: 0, seat_code: 'A1' });
    const res = mockRes();
    await bookingController.bookseat({ params: { scheduleId: 5 } }, res);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ seat_code: 'A1' })]);
  });
});

describe('GET /api/bookticket/:movieId', () => {
  it('groups upcoming schedules by date', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await Schedule.create([
      { id: 1, movie_id: 1, room_id: 1, movie_date: future, time_begin: '10:00', time_end: '12:00', price: 1 },
      { id: 2, movie_id: 1, room_id: 1, movie_date: future, time_begin: '14:00', time_end: '16:00', price: 1 },
    ]);
    const res = mockRes();
    await bookingController.bookticket({ params: { movieId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith([{ movie_date: future, times: ['10:00', '14:00'] }]);
  });
});

describe('POST /api/MomoPayment', () => {
  it('rejects a missing/empty ticketIds', async () => {
    const res = mockRes();
    await bookingController.createMomoPayment({ body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns the mock payUrl as plain text', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 50000 });
    await Ticket.create([
      { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 },
      { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 1 },
    ]);
    const res = mockRes();
    await bookingController.createMomoPayment(
      { body: { ticketIds: [1, 2], totalPrice: 50000 }, account: { accountId: 42 } },
      res,
    );
    expect(res.type).toHaveBeenCalledWith('text/plain');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('resultCode=0'));
  });

  it('rejects when a selected seat has already been sold', async () => {
    await Ticket.create([
      { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 },
      { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 0 },
    ]);
    const res = mockRes();
    await bookingController.createMomoPayment(
      { body: { ticketIds: [1, 2], totalPrice: 50000 }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SEAT_UNAVAILABLE', ticketIds: [2] }));
  });

  it('rejects when a selected seat is held by a different account', async () => {
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 999,
      held_until: new Date(Date.now() + 60000),
    });
    const res = mockRes();
    await bookingController.createMomoPayment(
      { body: { ticketIds: [1], totalPrice: 50000 }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SEAT_UNAVAILABLE' }));
  });

  it('allows checkout when the seat is held by the same account', async () => {
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 50000 });
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 42,
      held_until: new Date(Date.now() + 60000),
    });
    const res = mockRes();
    await bookingController.createMomoPayment(
      { body: { ticketIds: [1], totalPrice: 50000 }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('resultCode=0'));
  });
});

describe('POST /api/bookseat/:scheduleId/hold', () => {
  it('rejects a missing seatCodes', async () => {
    const res = mockRes();
    await bookingController.holdSeats({ params: { scheduleId: 1 }, body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('holds available seats for the caller', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
    const res = mockRes();
    await bookingController.holdSeats(
      { params: { scheduleId: 1 }, body: { seatCodes: ['A1'] }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(409);
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(2);
    expect(ticket.held_by).toBe(42);
  });

  it('rejects holding a seat already held by another account (authorization)', async () => {
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 7,
      held_until: new Date(Date.now() + 60000),
    });
    const res = mockRes();
    await bookingController.holdSeats(
      { params: { scheduleId: 1 }, body: { seatCodes: ['A1'] }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SEAT_UNAVAILABLE', seatCodes: ['A1'] }));
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.held_by).toBe(7);
  });

  it('rejects holding an already-sold seat', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
    const res = mockRes();
    await bookingController.holdSeats(
      { params: { scheduleId: 1 }, body: { seatCodes: ['A1'] }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('re-holding your own already-held seat extends the TTL instead of conflicting', async () => {
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 42,
      held_until: new Date(Date.now() + 1000),
    });
    const res = mockRes();
    await bookingController.holdSeats(
      { params: { scheduleId: 1 }, body: { seatCodes: ['A1'] }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(409);
  });

  it('picks up a seat whose hold has already expired', async () => {
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 7,
      held_until: new Date(Date.now() - 1000),
    });
    const res = mockRes();
    await bookingController.holdSeats(
      { params: { scheduleId: 1 }, body: { seatCodes: ['A1'] }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(409);
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.held_by).toBe(42);
  });
});

describe('POST /api/bookseat/:scheduleId/hold — concurrency', () => {
  it('two customers racing for the same seat: exactly one gets HELD, the other gets 409 SEAT_UNAVAILABLE', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A10', status: 1 });

    const resA = mockRes();
    const resB = mockRes();
    await Promise.all([
      bookingController.holdSeats(
        { params: { scheduleId: 1 }, body: { seatCodes: ['A10'] }, account: { accountId: 1 } },
        resA,
      ),
      bookingController.holdSeats(
        { params: { scheduleId: 1 }, body: { seatCodes: ['A10'] }, account: { accountId: 2 } },
        resB,
      ),
    ]);

    const statuses = [resA, resB].map((res) => (res.status.mock.calls[0] ? res.status.mock.calls[0][0] : 200));
    expect(statuses.filter((s) => s === 409)).toHaveLength(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);

    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(2);
    expect([1, 2]).toContain(ticket.held_by);
    
    const winnerRes = statuses[0] === 200 ? resA : resB;
    const [winnerBody] = winnerRes.json.mock.calls[0];
    expect(winnerBody.held[0].seat_code).toBe('A10');
  });
});

describe('POST /api/bookseat/:scheduleId/release', () => {
  it('rejects a missing seatCodes', async () => {
    const res = mockRes();
    await bookingController.releaseSeats({ params: { scheduleId: 1 }, body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('releases the caller\'s own held seat back to available', async () => {
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 42,
      held_until: new Date(Date.now() + 60000),
    });
    const res = mockRes();
    await bookingController.releaseSeats(
      { params: { scheduleId: 1 }, body: { seatCodes: ['A1'] }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(403);
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(1);
    expect(ticket.held_by).toBeNull();
  });

  it('forbids releasing a seat held by another account (authorization)', async () => {
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 7,
      held_until: new Date(Date.now() + 60000),
    });
    const res = mockRes();
    await bookingController.releaseSeats(
      { params: { scheduleId: 1 }, body: { seatCodes: ['A1'] }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_YOUR_HOLD' }));
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(2);
    expect(ticket.held_by).toBe(7);
  });
});

describe('POST /api/MomoPayment/ipn', () => {
  it('acknowledges without finalizing when resultCode is not 0', async () => {
    const res = mockRes();
    await bookingController.momoIpn({ body: { resultCode: '1', orderId: 'X' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ resultCode: 0 }));
    expect(await Invoice.countDocuments()).toBe(0);
  });

  it('releases the held seats immediately on payment failure, instead of waiting for the TTL', async () => {
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 42,
      held_until: new Date(Date.now() + 300000),
    });
    const extraData = Buffer.from(JSON.stringify({ ticketIds: [1], accountId: 42 })).toString('base64');
    const res = mockRes();
    await bookingController.momoIpn({ body: { resultCode: '1', orderId: 'X', extraData } }, res);
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(1);
    expect(ticket.held_by).toBeNull();
  });

  it('finalizes the order on a successful result', async () => {
    await Account.create({ id: 10, email: 'buyer@example.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
    const extraData = Buffer.from(JSON.stringify({ ticketIds: [1], accountId: 10, totalPrice: 1000 })).toString(
      'base64',
    );
    const res = mockRes();
    await bookingController.momoIpn({ body: { resultCode: '0', orderId: 'ORDER-1', extraData } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ resultCode: 0, message: 'Confirm Success' }));
    expect(await Invoice.countDocuments()).toBe(1);
  });
});

describe('POST /api/MomoPayment/confirm', () => {
  it('rejects when the payload account does not match the caller', async () => {
    const extraData = Buffer.from(JSON.stringify({ ticketIds: [1], accountId: 999 })).toString('base64');
    const res = mockRes();
    await bookingController.momoConfirm(
      { body: { resultCode: '0', orderId: 'X', extraData }, account: { accountId: 10 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('reports a payment failure', async () => {
    const res = mockRes();
    await bookingController.momoConfirm(
      { body: { resultCode: '1', message: 'Cancelled' }, account: { accountId: 10 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PAYMENT_FAILED' }));
  });

  it('releases the held seats immediately on payment failure, instead of waiting for the TTL', async () => {
    await Ticket.create({
      id: 1,
      schedule_id: 1,
      seat_index: 0,
      seat_code: 'A1',
      status: 2,
      held_by: 10,
      held_until: new Date(Date.now() + 300000),
    });
    const extraData = Buffer.from(JSON.stringify({ ticketIds: [1], accountId: 10 })).toString('base64');
    const res = mockRes();
    await bookingController.momoConfirm(
      { body: { resultCode: '1', message: 'Cancelled', extraData }, account: { accountId: 10 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(1);
    expect(ticket.held_by).toBeNull();
  });

  it('finalizes and returns success for a matching account', async () => {
    await Account.create({ id: 10, email: 'buyer@example.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
    const extraData = Buffer.from(JSON.stringify({ ticketIds: [1], accountId: 10, totalPrice: 1000 })).toString(
      'base64',
    );
    const res = mockRes();
    await bookingController.momoConfirm(
      { body: { resultCode: '0', orderId: 'ORDER-2', extraData }, account: { accountId: 10 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'success' }));
  });
});

describe('GET /api/my-invoices', () => {
  it('joins invoices with ticket, schedule and movie details', async () => {
    await Movie.create({ id: 1, name: 'Movie A', premiere_date: '2026-01-01' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 42, code: 'ABC', total_price: 1000 });

    const res = mockRes();
    await bookingController.myInvoices({ account: { accountId: 42 } }, res);
    const [result] = res.json.mock.calls[0];
    expect(result[0].movie.name).toBe('Movie A');
    expect(result[0].ticket.seat_code).toBe('A1');
  });
});

describe('GET /api/admin/invoices', () => {
  it('paginates invoices joined with ticket/movie/account summaries', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', name: 'Alice' });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1000 });
    const res = mockRes();
    await bookingController.adminInvoices({ query: {} }, res);
    const [result] = res.json.mock.calls[0];
    expect(result.total).toBe(1);
    expect(result.data[0].account.name).toBe('Alice');
  });
});

describe('GET /api/invoice/lookup/:code', () => {
  it('returns 404 for an unknown code', async () => {
    const res = mockRes();
    await bookingController.lookupInvoice({ params: { code: 'NOPE' }, account: { role: 0 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids a theater staff who does not own the cinema', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 99, name: 'Cinema', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1000 });

    const res = mockRes();
    await bookingController.lookupInvoice({ params: { code: 'abc' }, account: { role: 2, accountId: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows the owning theater staff to look up a booking', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Cinema', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1000 });

    const res = mockRes();
    await bookingController.lookupInvoice({ params: { code: 'ABC' }, account: { role: 2, accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ticket: expect.objectContaining({ seat_code: 'A1' }) }));
  });
});

describe('POST /api/invoice/:id/cancel', () => {
  it('returns 404 when the invoice does not exist', async () => {
    const res = mockRes();
    await bookingController.cancelInvoice({ params: { id: 999 }, account: { accountId: 1, role: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids cancelling another account\'s invoice', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 2, code: 'ABC', total_price: 100000, status: 1 });
    const res = mockRes();
    await bookingController.cancelInvoice({ params: { id: 1 }, account: { accountId: 1, role: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows an ALL-scope caller (admin) to cancel any invoice', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 2, code: 'ABC', total_price: 100000, status: 1 });
    const res = mockRes();
    await bookingController.cancelInvoice(
      { params: { id: 1 }, account: { accountId: 99, role: 0 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('rejects cancelling an already-cancelled invoice', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 100000, status: 0 });
    const res = mockRes();
    await bookingController.cancelInvoice({ params: { id: 1 }, account: { accountId: 1, role: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TICKET_ALREADY_CANCELLED' }));
  });

  it('rejects cancelling within 2 hours of showtime', async () => {
    const { movie_date, time_begin } = dateAt(1);
    await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      movie_date,
      time_begin,
      time_end: '23:59',
      price: 100000,
    });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 100000, status: 1 });

    const res = mockRes();
    await bookingController.cancelInvoice({ params: { id: 1 }, account: { accountId: 1, role: 1 } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CANCEL_WINDOW_EXPIRED' }));

    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(0);
  });

  it('cancels the invoice and reopens the seat when more than 2 hours away', async () => {
    const { movie_date, time_begin } = dateAt(5);
    await Schedule.create({
      id: 1,
      movie_id: 1,
      room_id: 1,
      movie_date,
      time_begin,
      time_end: '23:59',
      price: 100000,
    });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 100000, status: 1 });

    const res = mockRes();
    await bookingController.cancelInvoice({ params: { id: 1 }, account: { accountId: 1, role: 1 } }, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    const invoice = await Invoice.findOne({ id: 1 });
    expect(invoice.status).toBe(0);
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(1);
  });
});

describe('POST /api/invoice/:id/refund', () => {
  it('returns 404 when the invoice does not exist', async () => {
    const res = mockRes();
    await bookingController.refundInvoice({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects refunding an already-refunded invoice', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 100000, status: 2 });
    const res = mockRes();
    await bookingController.refundInvoice({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ALREADY_REFUNDED' }));
  });

  it('marks the invoice refunded and reopens the seat', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 100000, status: 1 });

    const res = mockRes();
    await bookingController.refundInvoice({ params: { id: 1 } }, res);

    const invoice = await Invoice.findOne({ id: 1 });
    expect(invoice.status).toBe(2);
    const ticket = await Ticket.findOne({ id: 1 });
    expect(ticket.status).toBe(1);
  });
});

describe('POST /api/invoice/:id/checkin', () => {
  it('returns 404 when the invoice does not exist', async () => {
    const res = mockRes();
    await bookingController.checkInInvoice({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects checking in an unpaid invoice', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1, status: 0 });
    const res = mockRes();
    await bookingController.checkInInvoice({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVOICE_NOT_PAID' }));
  });

  it('rejects checking in twice', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1, status: 1, checked_in: true });
    const res = mockRes();
    await bookingController.checkInInvoice({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ALREADY_CHECKED_IN' }));
  });

  it('marks a paid, not-yet-checked-in invoice as checked in', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1, status: 1 });
    const res = mockRes();
    await bookingController.checkInInvoice({ params: { id: 1 } }, res);
    const invoice = await Invoice.findOne({ id: 1 });
    expect(invoice.checked_in).toBe(true);
  });
});

describe('POST /api/invoice/counter-sale', () => {
  it('rejects a missing ticketIds', async () => {
    const res = mockRes();
    await bookingController.createCounterSale({ body: { accountId: 1 }, account: { accountId: 7 }, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a missing accountId', async () => {
    const res = mockRes();
    await bookingController.createCounterSale({ body: { ticketIds: [1] }, account: { accountId: 7 }, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects tickets that belong to a different cinema than the target', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'C1', code: 'A' });
    await Branch.create({ id: 2, company_id: 1, owner_id: 1, name: 'C2', code: 'B' });
    await Room.create({ id: 1, cinema_id: 2, name: 'R1' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });

    const res = mockRes();
    await bookingController.createCounterSale(
      { body: { ticketIds: [1], accountId: 1, totalPrice: 1000 }, account: { accountId: 7 }, branchId: 1 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TICKET_CINEMA_MISMATCH' }));
  });

  it('creates a paid counter-sale invoice tagged with the seller account id', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'C1', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });

    const res = mockRes();
    await bookingController.createCounterSale(
      { body: { ticketIds: [1], accountId: 1, totalPrice: 100000 }, account: { accountId: 7 }, branchId: 1 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const invoice = await Invoice.findOne({ ticket_id: 1 });
    expect(invoice.created_by).toBe(7);
    expect(invoice.status).toBe(1);
  });
});
