jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed

const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { localShowtime } = require('../../tests/inSeatFixtures');
const { authHeader } = require('../../tests/routeTestUtils');
const { errorHandler } = require('../middleware/errorHandler');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const seatSwapRoutes = require('./seatSwap.routes');
const bookingRoutes = require('./booking.routes');
const bookingRepository = require('../repositories/booking.repository');
const systemConfigService = require('../services/systemConfig.service');
const socket = require('../utils/socket');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const ComboOrder = require('../models/ComboOrder');
const Invoice = require('../models/Invoice');
const Movie = require('../models/Movie');
const Payment = require('../models/Payment');
const Refund = require('../models/Refund');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Seat = require('../models/Seat');
const SystemConfig = require('../models/SystemConfig');
const Ticket = require('../models/Ticket');

const app = express();
app.use(express.json());
app.use('/api/tickets', seatSwapRoutes);
app.use('/api', bookingRoutes);
app.use(errorHandler);

const ID = {
  SUPER_ADMIN: 1,
  OWNER_1: 42,
  OWNER_2: 43,
  LAN: 10,
  MINH: 20,
  BRANCH_1: 1,
  BRANCH_2: 2,
  ROOM: 5,
  SHOWTIME: 7,
  OTHER_SHOWTIME: 8,
  LAN_BOOKING: 100,
  LAN_REGULAR: 1000, // Lan's ticket on A1 (regular)
  LAN_VIP: 1001, // Lan's ticket on V2 (vip), same booking
  MINH_BOOKING: 200,
  MINH_INVOICE: 2000, // Minh's ticket on A4
};
// Ticket (seat) ids of showtime 7.
const SEAT = { A1: 1, A2: 2, A3: 3, V1: 4, A4: 5, A5: 6, A6: 7, A7: 8, V2: 9, OTHER_A2: 11 };

const as = (role, accountId) => authHeader({ role, accountId });
const auth = {
  lan: () => as(1, ID.LAN),
  minh: () => as(1, ID.MINH),
  owner1: () => as(2, ID.OWNER_1),
  owner2: () => as(2, ID.OWNER_2),
  superAdmin: () => as(0, ID.SUPER_ADMIN),
};

async function seedWorld({ startsInMinutes = 120 } = {}) {
  await seedRbac();
  await seedPositions();
  await Branch.create([
    { id: ID.BRANCH_1, company_id: 1, owner_id: ID.OWNER_1, name: 'CineNova Central', code: 'CEN' },
    { id: ID.BRANCH_2, company_id: 1, owner_id: ID.OWNER_2, name: 'CineNova Riverside', code: 'RIV' },
  ]);
  await Account.create([
    { id: ID.LAN, email: 'lan@example.com', password: 'x', name: 'Lan Nguyen', role: 1 },
    { id: ID.MINH, email: 'minh@example.com', password: 'x', name: 'Minh Tran', role: 1 },
  ]);
  await Movie.create({ id: 1, name: 'Dune: Part Three', premiere_date: '2026-01-01', duration: 120 });
  await Room.create({ id: ID.ROOM, cinema_id: ID.BRANCH_1, name: 'Hall 3' });
  await Seat.create([
    { id: 1, room_id: ID.ROOM, row: 'A', number: 1, seat_code: 'A1' },
    { id: 2, room_id: ID.ROOM, row: 'A', number: 2, seat_code: 'A2' },
    { id: 3, room_id: ID.ROOM, row: 'A', number: 3, seat_code: 'A3', status: 'DISABLED' },
    { id: 4, room_id: ID.ROOM, row: 'V', number: 1, seat_code: 'V1', seat_type: 1 },
    { id: 5, room_id: ID.ROOM, row: 'V', number: 2, seat_code: 'V2', seat_type: 1 },
  ]);
  await Schedule.create([
    { id: ID.SHOWTIME, movie_id: 1, room_id: ID.ROOM, cinema_id: ID.BRANCH_1, price: 90000, ...localShowtime(startsInMinutes) },
    { id: ID.OTHER_SHOWTIME, movie_id: 1, room_id: ID.ROOM, cinema_id: ID.BRANCH_1, price: 90000, ...localShowtime(600) },
  ]);
  const past = new Date(Date.now() - 60 * 1000);
  const future = new Date(Date.now() + 5 * 60 * 1000);
  await Ticket.create([
    { id: SEAT.A1, schedule_id: ID.SHOWTIME, seat_index: 0, seat_code: 'A1', status: Ticket.STATUS.BOOKED },
    { id: SEAT.A2, schedule_id: ID.SHOWTIME, seat_index: 1, seat_code: 'A2', status: Ticket.STATUS.AVAILABLE },
    // The ticket grid was generated before A3 was taken out of service, so its Ticket is still AVAILABLE.
    { id: SEAT.A3, schedule_id: ID.SHOWTIME, seat_index: 2, seat_code: 'A3', status: Ticket.STATUS.AVAILABLE },
    { id: SEAT.V1, schedule_id: ID.SHOWTIME, seat_index: 3, seat_code: 'V1', seat_type: 1, status: Ticket.STATUS.AVAILABLE },
    { id: SEAT.A4, schedule_id: ID.SHOWTIME, seat_index: 4, seat_code: 'A4', status: Ticket.STATUS.BOOKED },
    { id: SEAT.A5, schedule_id: ID.SHOWTIME, seat_index: 5, seat_code: 'A5', status: Ticket.STATUS.HELD, held_by: ID.MINH, held_until: future },
    { id: SEAT.A6, schedule_id: ID.SHOWTIME, seat_index: 6, seat_code: 'A6', status: Ticket.STATUS.HELD, held_by: ID.MINH, held_until: past },
    { id: SEAT.A7, schedule_id: ID.SHOWTIME, seat_index: 7, seat_code: 'A7', status: Ticket.STATUS.AVAILABLE },
    { id: SEAT.V2, schedule_id: ID.SHOWTIME, seat_index: 8, seat_code: 'V2', seat_type: 1, status: Ticket.STATUS.BOOKED },
    { id: SEAT.OTHER_A2, schedule_id: ID.OTHER_SHOWTIME, seat_index: 1, seat_code: 'A2', status: Ticket.STATUS.AVAILABLE },
  ]);
  await Booking.create([
    {
      id: ID.LAN_BOOKING,
      code: 'BK-100',
      account_id: ID.LAN,
      schedule_id: ID.SHOWTIME,
      branch_id: ID.BRANCH_1,
      ticket_ids: [SEAT.A1, SEAT.V2],
      seat_total: 198000,
      total_price: 198000,
      status: Booking.STATUS.PAID,
      paid_at: new Date(),
    },
    {
      id: ID.MINH_BOOKING,
      code: 'BK-200',
      account_id: ID.MINH,
      schedule_id: ID.SHOWTIME,
      branch_id: ID.BRANCH_1,
      ticket_ids: [SEAT.A4],
      seat_total: 90000,
      total_price: 90000,
      status: Booking.STATUS.PAID,
      paid_at: new Date(),
    },
  ]);
  const issued = (id, bookingId, ticketId, accountId, code, totalPrice) => ({
    id,
    booking_id: bookingId,
    ticket_id: ticketId,
    account_id: accountId,
    code,
    total_price: totalPrice,
    qr_token: `TCK-${id}`,
    ticket_status: Invoice.TICKET_STATUS.ISSUED,
    issued_at: new Date(),
  });
  await Invoice.create([
    issued(ID.LAN_REGULAR, ID.LAN_BOOKING, SEAT.A1, ID.LAN, 'BK-100', 99000),
    issued(ID.LAN_VIP, ID.LAN_BOOKING, SEAT.V2, ID.LAN, 'BK-100', 99000),
    issued(ID.MINH_INVOICE, ID.MINH_BOOKING, SEAT.A4, ID.MINH, 'BK-200', 90000),
  ]);
  await Payment.create([
    { id: 900, code: 'BK-100', booking_id: ID.LAN_BOOKING, account_id: ID.LAN, branch_id: ID.BRANCH_1, type: 'ONLINE', method: 'MOMO', amount: 198000, status: 'PAID', paid_at: new Date() },
    { id: 901, code: 'BK-200', booking_id: ID.MINH_BOOKING, account_id: ID.MINH, branch_id: ID.BRANCH_1, type: 'ONLINE', method: 'MOMO', amount: 90000, status: 'PAID', paid_at: new Date() },
  ]);
}

async function setPolicy(key, value, branchId = null) {
  await SystemConfig.create({ id: Math.floor(Math.random() * 1e9), key, branch_id: branchId, value });
  systemConfigService.invalidateAll();
}

const options = (invoiceId, header = auth.lan()) =>
  request(app).get(`/api/tickets/${invoiceId}/seat-swap`).set('Authorization', header);
const quote = (invoiceId, body, header = auth.lan()) =>
  request(app).post(`/api/tickets/${invoiceId}/seat-swap/quote`).set('Authorization', header).send(body);
const swap = (invoiceId, body, header = auth.lan()) =>
  request(app).post(`/api/tickets/${invoiceId}/seat-swap`).set('Authorization', header).send(body);

const ticketStatus = async (id) => (await Ticket.findOne({ id })).status;

// Nothing about the ticket, its booking or the seats moved.
async function expectUnchanged(invoiceId = ID.LAN_REGULAR, seatId = SEAT.A1) {
  const invoice = await Invoice.findOne({ id: invoiceId });
  expect(invoice.ticket_id).toBe(seatId);
  expect(invoice.qr_token).toBe(`TCK-${invoiceId}`);
  expect(invoice.seat_swaps).toHaveLength(0);
  expect(await ticketStatus(seatId)).toBe(Ticket.STATUS.BOOKED);
  expect(await ticketStatus(SEAT.A2)).toBe(Ticket.STATUS.AVAILABLE);
  expect(await AuditLog.countDocuments({ action: 'TICKET_SEAT_SWAPPED' })).toBe(0);
}

let errorSpy;
let logSpy;
beforeAll(async () => connect());
beforeEach(async () => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  systemConfigService.invalidateAll();
  await seedWorld();
});
afterEach(async () => {
  await clearDatabase();
  systemConfigService.invalidateAll();
  jest.clearAllMocks();
  logSpy.mockRestore();
  errorSpy.mockRestore();
});
afterAll(async () => closeDatabase());

describe('Ticket 50 flow — open ticket, request change, select, check, confirm, booking + ticket updated', () => {
  it('moves the ticket to an available seat of the same price and updates booking, ticket, seats and audit', async () => {
    // Request Seat Change
    const opened = await options(ID.LAN_REGULAR);
    expect(opened.status).toBe(200);
    expect(opened.body).toEqual(
      expect.objectContaining({
        ticket_id: ID.LAN_REGULAR,
        eligible: true,
        reason: null,
        policy: { after_payment: true, price_policy: 'SAME_PRICE_ONLY' },
        seat: { seat_id: SEAT.A1, seat_code: 'A1', seat_type: 0, price: 90000 },
        showtime: expect.objectContaining({ id: ID.SHOWTIME, room_id: ID.ROOM }),
      }),
    );

    // Select New Seat -> Check Availability
    const checked = await quote(ID.LAN_REGULAR, { seat_code: 'A2' });
    expect(checked.status).toBe(200);
    expect(checked.body).toEqual({
      from: { seat_id: SEAT.A1, seat_code: 'A1', seat_type: 0, price: 90000 },
      to: { seat_id: SEAT.A2, seat_code: 'A2', seat_type: 0, price: 90000 },
      price_difference: 0,
      settlement: 'NONE',
      price_policy: 'SAME_PRICE_ONLY',
      allowed: true,
    });
    // A quote reserves nothing.
    expect(await ticketStatus(SEAT.A2)).toBe(Ticket.STATUS.AVAILABLE);

    // Confirm
    const done = await swap(ID.LAN_REGULAR, { seat_code: 'A2' });
    expect(done.status).toBe(200);
    expect(done.body.ticket).toEqual(
      expect.objectContaining({ ticket_id: ID.LAN_REGULAR, seat_id: SEAT.A2, seat_code: 'A2', status: 'ISSUED' }),
    );
    expect(done.body.ticket.seat_swaps).toEqual([
      expect.objectContaining({ from_seat_code: 'A1', to_seat_code: 'A2', price_difference: 0, settlement: 'NONE' }),
    ]);
    expect(done.body.swap).toEqual(
      expect.objectContaining({ from_seat_code: 'A1', to_seat_code: 'A2', old_price: 90000, new_price: 90000, swapped_by: ID.LAN }),
    );

    // Update Ticket: points at the new seat, with a fresh QR and the history entry.
    const invoice = await Invoice.findOne({ id: ID.LAN_REGULAR });
    expect(invoice.ticket_id).toBe(SEAT.A2);
    expect(invoice.qr_token).toMatch(/^TCK-/);
    expect(invoice.qr_token).not.toBe(`TCK-${ID.LAN_REGULAR}`);
    expect(invoice.seat_swaps).toHaveLength(1);
    expect(invoice.total_price).toBe(99000); // money untouched
    // Update Booking: the seat list follows, in place; totals unchanged.
    const booking = await Booking.findOne({ id: ID.LAN_BOOKING });
    expect(booking.ticket_ids).toEqual([SEAT.A2, SEAT.V2]);
    expect(booking.total_price).toBe(198000);
    expect(booking.status).toBe('PAID');
    // Seats: the old one is free for others, the new one is sold.
    expect(await ticketStatus(SEAT.A1)).toBe(Ticket.STATUS.AVAILABLE);
    expect(await ticketStatus(SEAT.A2)).toBe(Ticket.STATUS.BOOKED);
    // The live seat map hears about both.
    expect(socket.emitToSchedule).toHaveBeenCalledWith(ID.SHOWTIME, 'seat:updated', { scheduleId: ID.SHOWTIME, seatCodes: ['A1'], status: 'AVAILABLE' });
    expect(socket.emitToSchedule).toHaveBeenCalledWith(ID.SHOWTIME, 'seat:updated', { scheduleId: ID.SHOWTIME, seatCodes: ['A2'], status: 'BOOKED' });
    expect(socket.emitToAccount).toHaveBeenCalledWith(ID.LAN, 'booking:updated', expect.objectContaining({ bookingId: ID.LAN_BOOKING }));

    // Audit Log
    const audit = await AuditLog.findOne({ action: 'TICKET_SEAT_SWAPPED' });
    expect(audit).toEqual(
      expect.objectContaining({ entity_type: 'TICKET', entity_id: ID.LAN_REGULAR, performed_by: ID.LAN, branch_id: ID.BRANCH_1 }),
    );
    expect(audit.metadata).toEqual(
      expect.objectContaining({
        booking_code: 'BK-100',
        from_seat: 'A1',
        to_seat: 'A2',
        old_price: 90000,
        new_price: 90000,
        price_difference: 0,
        channel: 'CUSTOMER',
      }),
    );

    // Open Ticket again: the customer's ticket shows the new seat.
    const reopened = await request(app).get(`/api/my-tickets/${ID.LAN_REGULAR}`).set('Authorization', auth.lan());
    expect(reopened.status).toBe(200);
    expect(reopened.body.seat_code).toBe('A2');
    expect(reopened.body.qr_token).toBe(invoice.qr_token);
  });

  it('the old QR no longer opens the ticket at the door; the new one does', async () => {
    expect((await swap(ID.LAN_REGULAR, { seat_code: 'A2' })).status).toBe(200);
    const { qr_token } = await Invoice.findOne({ id: ID.LAN_REGULAR });
    const verify = (token) =>
      request(app).post('/api/tickets/verify').set('Authorization', auth.owner1()).send({ qr_token: token });
    expect((await verify(`TCK-${ID.LAN_REGULAR}`)).status).toBe(404);
    const fresh = await verify(qr_token);
    expect(fresh.status).toBe(200);
    expect(fresh.body.seat_code).toBe('A2');
  });

  it('accepts the new seat by its seat-grid id as well as by its code', async () => {
    const res = await swap(ID.LAN_REGULAR, { seat_id: SEAT.A7 });
    expect(res.status).toBe(200);
    expect(res.body.ticket.seat_code).toBe('A7');
  });
});

describe('Ticket phải hợp lệ', () => {
  it.each(['USED', 'CANCELLED', 'REFUNDED', 'EXPIRED'])('refuses a %s ticket', async (status) => {
    await Invoice.updateOne({ id: ID.LAN_REGULAR }, { $set: { ticket_status: status, status: status === 'USED' ? 1 : 0 } });
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ code: 'SEAT_SWAP_TICKET_INVALID', ticket_status: status }));
    expect(await ticketStatus(SEAT.A2)).toBe(Ticket.STATUS.AVAILABLE);
    const opened = await options(ID.LAN_REGULAR);
    expect(opened.body).toEqual(expect.objectContaining({ eligible: false, reason: expect.objectContaining({ code: 'SEAT_SWAP_TICKET_INVALID' }) }));
  });

  it('refuses a ticket whose booking is no longer paid', async () => {
    await Booking.updateOne({ id: ID.LAN_BOOKING }, { $set: { status: 'CANCELLED' } });
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SEAT_SWAP_TICKET_INVALID');
  });

  it('refuses while a refund of the booking is in progress', async () => {
    await Refund.create({ id: 1, booking_id: ID.LAN_BOOKING, payment_id: 900, account_id: ID.LAN, amount: 99000, policy_percent: 50 });
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SEAT_SWAP_REFUND_IN_PROGRESS');
    await expectUnchanged();
  });

  it('refuses while food ordered to the old seat is still on its way', async () => {
    await ComboOrder.create({
      id: 1,
      code: 'CO-1',
      branch_id: ID.BRANCH_1,
      account_id: ID.LAN,
      booking_id: ID.LAN_BOOKING,
      items: [{ combo_id: 1, name: 'Popcorn', unit_price: 65000, quantity: 1, line_total: 65000 }],
      total_price: 65000,
      status: 'PREPARING',
      channel: 'IN_SEAT',
      seat_delivery: { schedule_id: ID.SHOWTIME, room_id: ID.ROOM, seat_code: 'A1', invoice_id: ID.LAN_REGULAR },
    });
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SEAT_SWAP_IN_SEAT_ORDER_OPEN');

    await ComboOrder.updateOne({ id: 1 }, { $set: { status: 'DELIVERED' } });
    expect((await swap(ID.LAN_REGULAR, { seat_code: 'A2' })).status).toBe(200);
  });

  it('404s an unknown ticket', async () => {
    const res = await swap(999999, { seat_code: 'A2' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TICKET_NOT_FOUND');
  });
});

describe('Showtime chưa bắt đầu', () => {
  it('refuses once the showtime has started', async () => {
    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: localShowtime(-5) });
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SEAT_SWAP_SHOWTIME_STARTED');
    await expectUnchanged();
  });

  it('refuses on a cancelled showtime', async () => {
    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { status: 'CANCELLED' } });
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SCHEDULE_CANCELLED');
  });
});

describe('New Seat phải AVAILABLE', () => {
  it.each([
    ['sold to someone else', 'A4'],
    ['held by another customer', 'A5'],
  ])('refuses a seat %s', async (_label, seatCode) => {
    const res = await swap(ID.LAN_REGULAR, { seat_code: seatCode });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(expect.objectContaining({ code: 'SEAT_UNAVAILABLE', seatCodes: [seatCode] }));
    await expectUnchanged();
  });

  it('a hold that has already lapsed does not block the seat', async () => {
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A6' });
    expect(res.status).toBe(200);
    expect(res.body.ticket.seat_code).toBe('A6');
    expect(await Ticket.findOne({ id: SEAT.A6 })).toEqual(expect.objectContaining({ status: Ticket.STATUS.BOOKED, held_by: null }));
  });

  it('refuses a seat taken out of service, even though its grid ticket is still AVAILABLE', async () => {
    const res = await quote(ID.LAN_REGULAR, { seat_code: 'A3' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SEAT_DISABLED');
  });

  it('refuses the seat the ticket is already on, and a seat code that does not exist', async () => {
    expect((await swap(ID.LAN_REGULAR, { seat_code: 'A1' })).body.code).toBe('SEAT_SWAP_SAME_SEAT');
    const missing = await swap(ID.LAN_REGULAR, { seat_code: 'Z9' });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('SEAT_NOT_FOUND');
  });
});

describe('Không được đổi sang Seat thuộc Showtime khác', () => {
  it('refuses a seat id of another showtime', async () => {
    const res = await swap(ID.LAN_REGULAR, { seat_id: SEAT.OTHER_A2 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SEAT_SWAP_SHOWTIME_MISMATCH');
    await expectUnchanged();
    expect(await ticketStatus(SEAT.OTHER_A2)).toBe(Ticket.STATUS.AVAILABLE);
  });

  it('refuses a request that names another showtime, even with a seat code that exists there', async () => {
    const res = await swap(ID.LAN_REGULAR, { schedule_id: ID.OTHER_SHOWTIME, seat_code: 'A2' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SEAT_SWAP_SHOWTIME_MISMATCH');
    await expectUnchanged();
  });
});

describe('Price difference — calculated by the backend only', () => {
  it('quotes the difference for a more expensive seat and refuses it, whatever the policy', async () => {
    const expectRefused = async () => {
      const res = await swap(ID.LAN_REGULAR, { seat_code: 'V1' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('SEAT_SWAP_UPGRADE_NOT_ALLOWED');
      expect(res.body.quote).toEqual(
        expect.objectContaining({
          from: expect.objectContaining({ seat_code: 'A1', price: 90000 }),
          to: expect.objectContaining({ seat_code: 'V1', seat_type: 1, price: 108000 }),
          price_difference: 18000,
          allowed: false,
        }),
      );
    };
    await expectRefused();
    await setPolicy('SEAT_SWAP_PRICE_POLICY', 'ALLOW_CHEAPER');
    await expectRefused();
    await expectUnchanged();
  });

  it('SAME_PRICE_ONLY (default) refuses a cheaper seat and says by how much', async () => {
    const res = await quote(ID.LAN_VIP, { seat_code: 'A2' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SEAT_SWAP_PRICE_MISMATCH');
    expect(res.body.quote).toEqual(expect.objectContaining({ price_difference: -18000, price_policy: 'SAME_PRICE_ONLY' }));
  });

  it('ALLOW_CHEAPER lets the ticket move to a cheaper seat; the difference is recorded, not refunded', async () => {
    await setPolicy('SEAT_SWAP_PRICE_POLICY', 'ALLOW_CHEAPER', ID.BRANCH_1);
    const checked = await quote(ID.LAN_VIP, { seat_code: 'A2' });
    expect(checked.status).toBe(200);
    expect(checked.body).toEqual(
      expect.objectContaining({ price_difference: -18000, settlement: 'NOT_REFUNDED', price_policy: 'ALLOW_CHEAPER' }),
    );

    const res = await swap(ID.LAN_VIP, { seat_code: 'A2' });
    expect(res.status).toBe(200);
    expect(res.body.swap).toEqual(
      expect.objectContaining({ old_price: 108000, new_price: 90000, price_difference: -18000, settlement: 'NOT_REFUNDED' }),
    );
    const booking = await Booking.findOne({ id: ID.LAN_BOOKING });
    expect(booking.ticket_ids).toEqual([SEAT.A1, SEAT.A2]);
    expect(booking.total_price).toBe(198000);
    expect(await Payment.findOne({ id: 900 })).toEqual(expect.objectContaining({ status: 'PAID', amount: 198000 }));
    const audit = await AuditLog.findOne({ action: 'TICKET_SEAT_SWAPPED' });
    expect(audit.metadata).toEqual(expect.objectContaining({ price_difference: -18000, settlement: 'NOT_REFUNDED' }));
  });

  it('refuses a client-supplied price instead of trusting it', async () => {
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'V1', price_difference: 0 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ code: 'SEAT_SWAP_PRICE_READONLY', fields: ['price_difference'] }));
    const extra = await swap(ID.LAN_REGULAR, { seat_code: 'A2', booking_id: 1 });
    expect(extra.body.code).toBe('SEAT_SWAP_FIELD_NOT_ALLOWED');
    expect((await swap(ID.LAN_REGULAR, {})).body.code).toBe('SEAT_SWAP_SEAT_REQUIRED');
    await expectUnchanged();
  });
});

describe('Policy không cho đổi Seat sau Payment', () => {
  it('answers with a clear validation error on every step, and the page learns why up front', async () => {
    await setPolicy('SEAT_SWAP_AFTER_PAYMENT', false, ID.BRANCH_1);

    const opened = await options(ID.LAN_REGULAR);
    expect(opened.status).toBe(200);
    expect(opened.body).toEqual(
      expect.objectContaining({
        eligible: false,
        reason: { code: 'SEAT_SWAP_NOT_ALLOWED_AFTER_PAYMENT', message: "This cinema's policy does not allow changing seats after payment" },
        policy: expect.objectContaining({ after_payment: false }),
      }),
    );
    for (const call of [quote, swap]) {
      const res = await call(ID.LAN_REGULAR, { seat_code: 'A2' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          code: 'SEAT_SWAP_NOT_ALLOWED_AFTER_PAYMENT',
          message: "This cinema's policy does not allow changing seats after payment",
        }),
      );
    }
    await expectUnchanged();
  });

  it('a global switch-off applies too, and a branch can switch it back on for itself', async () => {
    await setPolicy('SEAT_SWAP_AFTER_PAYMENT', false);
    expect((await swap(ID.LAN_REGULAR, { seat_code: 'A2' })).body.code).toBe('SEAT_SWAP_NOT_ALLOWED_AFTER_PAYMENT');
    await setPolicy('SEAT_SWAP_AFTER_PAYMENT', true, ID.BRANCH_1);
    expect((await swap(ID.LAN_REGULAR, { seat_code: 'A2' })).status).toBe(200);
  });
});

describe("Không cho Customer đổi Ticket của Customer khác", () => {
  it("a customer cannot open, quote or swap another customer's ticket", async () => {
    for (const res of [
      await options(ID.LAN_REGULAR, auth.minh()),
      await quote(ID.LAN_REGULAR, { seat_code: 'A2' }, auth.minh()),
      await swap(ID.LAN_REGULAR, { seat_code: 'A2' }, auth.minh()),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TICKET_NOT_OWNED');
    }
    await expectUnchanged();
  });

  it('the booking owner check holds even if the ticket row itself names the caller', async () => {
    await Invoice.updateOne({ id: ID.LAN_REGULAR }, { $set: { account_id: ID.MINH } });
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' }, auth.minh());
    expect(res.status).toBe(403);
  });

  it("a Branch Admin may change a seat at their own branch only (recorded as STAFF)", async () => {
    expect((await swap(ID.LAN_REGULAR, { seat_code: 'A2' }, auth.owner2())).status).toBe(403);
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' }, auth.owner1());
    expect(res.status).toBe(200);
    const audit = await AuditLog.findOne({ action: 'TICKET_SEAT_SWAPPED' });
    expect(audit.performed_by).toBe(ID.OWNER_1);
    expect(audit.metadata.channel).toBe('STAFF');
  });

  it('a role without ticket.swapSeat is refused before anything is read', async () => {
    const res = await swap(ID.LAN_REGULAR, { seat_code: 'A2' }, as(3, 77));
    expect(res.status).toBe(403);
    await expectUnchanged();
  });
});

describe('Races', () => {
  it('two customers going for the same free seat: exactly one gets it, the other keeps their own seat', async () => {
    const [lan, minh] = await Promise.all([
      swap(ID.LAN_REGULAR, { seat_code: 'A2' }),
      swap(ID.MINH_INVOICE, { seat_code: 'A2' }, auth.minh()),
    ]);
    const statuses = [lan.status, minh.status].sort();
    expect(statuses).toEqual([200, 409]);
    const winner = lan.status === 200 ? ID.LAN_REGULAR : ID.MINH_INVOICE;
    const loser = winner === ID.LAN_REGULAR ? ID.MINH_INVOICE : ID.LAN_REGULAR;
    expect((await Invoice.findOne({ id: winner })).ticket_id).toBe(SEAT.A2);
    const loserSeat = loser === ID.LAN_REGULAR ? SEAT.A1 : SEAT.A4;
    expect((await Invoice.findOne({ id: loser })).ticket_id).toBe(loserSeat);
    expect(await ticketStatus(loserSeat)).toBe(Ticket.STATUS.BOOKED);
    expect(await ticketStatus(SEAT.A2)).toBe(Ticket.STATUS.BOOKED);
  });

  it('a double-submitted swap of one ticket to two seats: one wins, the other seat is not left sold', async () => {
    const results = await Promise.all([swap(ID.LAN_REGULAR, { seat_code: 'A2' }), swap(ID.LAN_REGULAR, { seat_code: 'A7' })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const invoice = await Invoice.findOne({ id: ID.LAN_REGULAR });
    expect(invoice.seat_swaps).toHaveLength(1);
    const won = invoice.ticket_id;
    const lost = won === SEAT.A2 ? SEAT.A7 : SEAT.A2;
    expect([SEAT.A2, SEAT.A7]).toContain(won);
    expect(await ticketStatus(won)).toBe(Ticket.STATUS.BOOKED);
    expect(await ticketStatus(lost)).toBe(Ticket.STATUS.AVAILABLE);
    expect(await ticketStatus(SEAT.A1)).toBe(Ticket.STATUS.AVAILABLE);
    expect((await Booking.findOne({ id: ID.LAN_BOOKING })).ticket_ids).toEqual([won, SEAT.V2]);
    expect(await AuditLog.countDocuments({ action: 'TICKET_SEAT_SWAPPED' })).toBe(1);
  });
});

describe('booking.repository.swapInvoiceSeat — undo when a later step loses', () => {
  const args = () => ({
    invoiceId: ID.LAN_REGULAR,
    bookingId: ID.LAN_BOOKING,
    scheduleId: ID.SHOWTIME,
    fromTicket: { id: SEAT.A1, schedule_id: ID.SHOWTIME, seat_code: 'A1' },
    toTicket: { id: SEAT.A2, schedule_id: ID.SHOWTIME, seat_code: 'A2' },
    qrToken: 'TCK-new',
    swap: {
      from_ticket_id: SEAT.A1,
      from_seat_code: 'A1',
      to_ticket_id: SEAT.A2,
      to_seat_code: 'A2',
      old_price: 90000,
      new_price: 90000,
      price_difference: 0,
      settlement: 'NONE',
      swapped_at: new Date(),
    },
  });

  it('the ticket was checked in meanwhile: the claimed seat is released', async () => {
    await Invoice.updateOne({ id: ID.LAN_REGULAR }, { $set: { ticket_status: 'USED' } });
    expect(await bookingRepository.swapInvoiceSeat(args())).toEqual({ conflict: 'TICKET_CHANGED' });
    expect(await ticketStatus(SEAT.A2)).toBe(Ticket.STATUS.AVAILABLE);
    expect((await Invoice.findOne({ id: ID.LAN_REGULAR })).ticket_id).toBe(SEAT.A1);
  });

  it('the booking was cancelled meanwhile: the ticket move and the seat claim are both undone', async () => {
    await Booking.updateOne({ id: ID.LAN_BOOKING }, { $set: { status: 'CANCELLED' } });
    expect(await bookingRepository.swapInvoiceSeat(args())).toEqual({ conflict: 'BOOKING_CHANGED' });
    const invoice = await Invoice.findOne({ id: ID.LAN_REGULAR });
    expect(invoice.ticket_id).toBe(SEAT.A1);
    expect(invoice.qr_token).toBe(`TCK-${ID.LAN_REGULAR}`);
    expect(invoice.seat_swaps).toHaveLength(0);
    expect(await ticketStatus(SEAT.A2)).toBe(Ticket.STATUS.AVAILABLE);
    expect(await ticketStatus(SEAT.A1)).toBe(Ticket.STATUS.BOOKED);
  });

  it('the seat was taken meanwhile: nothing is written', async () => {
    await Ticket.updateOne({ id: SEAT.A2 }, { $set: { status: Ticket.STATUS.BOOKED } });
    expect(await bookingRepository.swapInvoiceSeat(args())).toEqual({ conflict: 'SEAT_TAKEN' });
    expect((await Invoice.findOne({ id: ID.LAN_REGULAR })).ticket_id).toBe(SEAT.A1);
  });
});
