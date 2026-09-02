const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const boxOfficeController = require('./boxOffice.controller');
const Ticket = require('../models/Ticket');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
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

async function setupBranchAndSchedule() {
  await Branch.create({ id: 5, company_id: 1, owner_id: 1, name: 'C1', code: 'A' });
  await Room.create({ id: 1, cinema_id: 5, name: 'R1' });
  await Schedule.create({
    id: 1,
    movie_id: 1,
    room_id: 1,
    movie_date: '2026-01-01',
    time_begin: '10:00',
    time_end: '12:00',
    price: 100000,
  });
}

describe('boxOffice.controller sellTickets', () => {
  it('rejects a missing scheduleId/ticketIds', async () => {
    const res = mockRes();
    await boxOfficeController.sellTickets({ body: { accountId: 1 }, headers: {}, account: { accountId: 7 }, branchId: 5 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a missing accountId', async () => {
    const res = mockRes();
    await boxOfficeController.sellTickets(
      { body: { scheduleId: 1, ticketIds: [1] }, headers: {}, account: { accountId: 7 }, branchId: 5 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects both a voucherCode and a promotionCode', async () => {
    const res = mockRes();
    await boxOfficeController.sellTickets(
      {
        body: { scheduleId: 1, ticketIds: [1], accountId: 1, voucherCode: 'V', promotionCode: 'P' },
        headers: {},
        account: { accountId: 7 },
        branchId: 5,
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DISCOUNT_CONFLICT' }));
  });

  it('rejects an unsupported payment method', async () => {
    const res = mockRes();
    await boxOfficeController.sellTickets(
      { body: { scheduleId: 1, ticketIds: [1], accountId: 1, method: 'BITCOIN' }, headers: {}, account: { accountId: 7 }, branchId: 5 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_METHOD' }));
  });

  it('rejects an unlocked (never held) seat', async () => {
    await setupBranchAndSchedule();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });

    const res = mockRes();
    await boxOfficeController.sellTickets(
      { body: { scheduleId: 1, ticketIds: [1], accountId: 1 }, headers: {}, account: { accountId: 7 }, branchId: 5 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SEAT_NOT_LOCKED' }));
  });

  it('rejects a seat that is already BOOKED', async () => {
    await setupBranchAndSchedule();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });

    const res = mockRes();
    await boxOfficeController.sellTickets(
      { body: { scheduleId: 1, ticketIds: [1], accountId: 1 }, headers: {}, account: { accountId: 7 }, branchId: 5 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SEAT_NOT_LOCKED' }));
  });

  it('rejects a seat held by a different employee', async () => {
    await setupBranchAndSchedule();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 999 });

    const res = mockRes();
    await boxOfficeController.sellTickets(
      { body: { scheduleId: 1, ticketIds: [1], accountId: 1 }, headers: {}, account: { accountId: 7 }, branchId: 5 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SEAT_NOT_LOCKED' }));
  });

  it('rejects a ticket that belongs to a different cinema than the target', async () => {
    await setupBranchAndSchedule();
    await Branch.create({ id: 6, company_id: 1, owner_id: 1, name: 'C2', code: 'B' });
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7 });

    const res = mockRes();
    await boxOfficeController.sellTickets(
      { body: { scheduleId: 1, ticketIds: [1], accountId: 1 }, headers: {}, account: { accountId: 7 }, branchId: 6 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TICKET_CINEMA_MISMATCH' }));
  });

  it('rejects a sale on a CANCELLED showtime', async () => {
    await setupBranchAndSchedule();
    await Schedule.updateOne({ id: 1 }, { $set: { status: 'CANCELLED' } });
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7 });

    const res = mockRes();
    await boxOfficeController.sellTickets(
      { body: { scheduleId: 1, ticketIds: [1], accountId: 1 }, headers: {}, account: { accountId: 7 }, branchId: 5 },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCHEDULE_CANCELLED' }));
  });

  it('sells a locked seat, recomputing the price server-side and ignoring a client-sent totalPrice', async () => {
    await setupBranchAndSchedule();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7 });

    const res = mockRes();
    await boxOfficeController.sellTickets(
      {
        body: { scheduleId: 1, ticketIds: [1], accountId: 1, totalPrice: 1, method: 'CARD' },
        headers: {},
        account: { accountId: 7 },
        branchId: 5,
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const [payload] = res.json.mock.calls[0];
    expect(payload.totalPrice).toBe(100000);
    expect(payload.code).toMatch(/^POS-\d+$/);

    const booking = await Booking.findOne({ id: payload.bookingId });
    expect(booking.status).toBe('PAID');
    expect((await Ticket.findOne({ id: 1 })).status).toBe(0);

    const payment = await Payment.findOne({ code: payload.code });
    expect(payment.method).toBe('CARD');
    expect(payment.amount).toBe(100000);

    const invoice = await Invoice.findOne({ ticket_id: 1 });
    expect(invoice.created_by).toBe(7);
  });

  it('is idempotent on the Idempotency-Key header — a retry never sells twice', async () => {
    await setupBranchAndSchedule();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7 });

    const req = {
      body: { scheduleId: 1, ticketIds: [1], accountId: 1, method: 'CASH' },
      headers: { 'idempotency-key': 'retry-key-1' },
      account: { accountId: 7 },
      branchId: 5,
    };

    const res1 = mockRes();
    await boxOfficeController.sellTickets(req, res1);
    const [firstPayload] = res1.json.mock.calls[0];

    const res2 = mockRes();
    await boxOfficeController.sellTickets(req, res2);
    const [secondPayload] = res2.json.mock.calls[0];

    expect(secondPayload.alreadyProcessed).toBe(true);
    expect(secondPayload.bookingId).toBe(firstPayload.bookingId);
    expect(await Payment.countDocuments({})).toBe(1);
    expect(await Booking.countDocuments({})).toBe(1);
    expect(await Invoice.countDocuments({})).toBe(1);
  });
});

describe('boxOffice.controller getBookingTickets', () => {
  it('returns 404 for an unknown booking', async () => {
    const res = mockRes();
    await boxOfficeController.getBookingTickets({ params: { id: 999 }, account: { accountId: 7 }, permissionScope: 'ALL' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids a BRANCH-scoped caller not staffed at the booking branch', async () => {
    await Booking.create({ id: 1, code: 'POS-1', account_id: 1, schedule_id: 1, branch_id: 5, total_price: 1 });
    const res = mockRes();
    await boxOfficeController.getBookingTickets({ params: { id: 1 }, account: { accountId: 7 }, permissionScope: 'BRANCH' }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns the ticket views for a booking the caller can access', async () => {
    await setupBranchAndSchedule();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
    const booking = await Booking.create({ id: 1, code: 'POS-1', account_id: 1, schedule_id: 1, branch_id: 5, total_price: 100000 });
    await Invoice.create({
      id: 1,
      booking_id: 1,
      ticket_id: 1,
      account_id: 1,
      code: 'POS-1',
      total_price: 100000,
      qr_token: 'qr-1',
      ticket_status: 'ISSUED',
    });

    const res = mockRes();
    await boxOfficeController.getBookingTickets({ params: { id: booking.id }, account: { accountId: 7 }, permissionScope: 'ALL' }, res);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.status).not.toHaveBeenCalledWith(404);
    const [payload] = res.json.mock.calls[0];
    expect(payload.tickets).toHaveLength(1);
    expect(payload.tickets[0].seat_code).toBe('A1');
    expect(payload.tickets[0].qr_token).toBe('qr-1');
  });
});
