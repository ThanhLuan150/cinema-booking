const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const bookingController = require('./booking.controller');
const Invoice = require('../models/Invoice');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Cinema = require('../models/Cinema');
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
    const res = mockRes();
    await bookingController.createMomoPayment(
      { body: { ticketIds: [1, 2], totalPrice: 50000 }, account: { accountId: 42 } },
      res,
    );
    expect(res.type).toHaveBeenCalledWith('text/plain');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('resultCode=0'));
  });
});

describe('POST /api/MomoPayment/ipn', () => {
  it('acknowledges without finalizing when resultCode is not 0', async () => {
    const res = mockRes();
    await bookingController.momoIpn({ body: { resultCode: '1', orderId: 'X' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ resultCode: 0 }));
    expect(await Invoice.countDocuments()).toBe(0);
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
    await Cinema.create({ id: 1, owner_id: 99, name: 'Cinema' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1000 });

    const res = mockRes();
    await bookingController.lookupInvoice({ params: { code: 'abc' }, account: { role: 2, accountId: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows the owning theater staff to look up a booking', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'Cinema' });
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
    await Cinema.create({ id: 1, owner_id: 1, name: 'C1' });
    await Cinema.create({ id: 2, owner_id: 1, name: 'C2' });
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
    await Cinema.create({ id: 1, owner_id: 1, name: 'C1' });
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
