const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const kioskController = require('./kiosk.controller');
const bookingRepository = require('../repositories/booking.repository');
const Kiosk = require('../models/Kiosk');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
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
let errSpy;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  await clearDatabase();
  logSpy.mockRestore();
  errSpy.mockRestore();
});
afterAll(async () => closeDatabase());

const BRANCH_A = 5;
const BRANCH_B = 6;

// Sets up: branch A with a room + schedule + 3 available seat tickets, branch B with its own
// schedule, and two kiosks (each with its own guest account) — kiosk 1 at branch A, kiosk 2
// also at branch A (for the concurrency test), kiosk 3 at branch B.
async function setup() {
  await Branch.create([
    { id: BRANCH_A, company_id: 1, owner_id: 1, name: 'Branch A', code: 'A' },
    { id: BRANCH_B, company_id: 1, owner_id: 2, name: 'Branch B', code: 'B' },
  ]);
  await Room.create([
    { id: 1, cinema_id: BRANCH_A, name: 'R1' },
    { id: 2, cinema_id: BRANCH_B, name: 'R2' },
  ]);
  await Schedule.create([
    { id: 1, movie_id: 1, room_id: 1, cinema_id: BRANCH_A, movie_date: '2999-01-01', time_begin: '10:00', time_end: '12:00', price: 100000 },
    { id: 2, movie_id: 1, room_id: 2, cinema_id: BRANCH_B, movie_date: '2999-01-01', time_begin: '10:00', time_end: '12:00', price: 100000 },
  ]);
  await Ticket.create([
    { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 },
    { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 1 },
    { id: 3, schedule_id: 1, seat_index: 2, seat_code: 'A3', status: 1 },
  ]);
  await Account.create([
    { id: 901, email: 'kiosk-1@kiosk.local', password: 'x', name: 'K1', role: 1 },
    { id: 902, email: 'kiosk-2@kiosk.local', password: 'x', name: 'K2', role: 1 },
    { id: 903, email: 'kiosk-3@kiosk.local', password: 'x', name: 'K3', role: 1 },
  ]);
  await Kiosk.create([
    { id: 1, kiosk_code: 'K1', name: 'Kiosk 1', branch_id: BRANCH_A, guest_account_id: 901, api_key_hash: 'h1' },
    { id: 2, kiosk_code: 'K2', name: 'Kiosk 2', branch_id: BRANCH_A, guest_account_id: 902, api_key_hash: 'h2' },
    { id: 3, kiosk_code: 'K3', name: 'Kiosk 3', branch_id: BRANCH_B, guest_account_id: 903, api_key_hash: 'h3' },
  ]);
}

function reqFor(kioskId, extra = {}) {
  const kioskById = {
    1: { id: 1, kiosk_code: 'K1', name: 'Kiosk 1', branch_id: BRANCH_A, guest_account_id: 901, status: 'ACTIVE' },
    2: { id: 2, kiosk_code: 'K2', name: 'Kiosk 2', branch_id: BRANCH_A, guest_account_id: 902, status: 'ACTIVE' },
    3: { id: 3, kiosk_code: 'K3', name: 'Kiosk 3', branch_id: BRANCH_B, guest_account_id: 903, status: 'ACTIVE' },
  };
  return { kiosk: kioskById[kioskId], params: {}, body: {}, headers: {}, query: {}, ...extra };
}

async function holdViaKiosk(kioskId, seatCodes) {
  const res = mockRes();
  await kioskController.holdSeats(
    reqFor(kioskId, { params: { scheduleId: '1' }, body: { seatCodes } }),
    res,
  );
  return res;
}

describe('kiosk.controller — self-service flow', () => {
  beforeEach(setup);

  describe('branch isolation (Ticket 31 security)', () => {
    it('rejects seat listing for a schedule at another branch', async () => {
      const res = mockRes();
      await kioskController.listSeats(reqFor(3, { params: { scheduleId: '1' } }), res); // kiosk at B, schedule at A
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'KIOSK_BRANCH_MISMATCH' }));
    });

    it('rejects holding a seat on another branch schedule', async () => {
      const res = await holdViaKiosk(3, ['A1']);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects checkout for tickets at another branch', async () => {
      await holdViaKiosk(1, ['A1']); // legitimately held by kiosk 1 (branch A)
      const res = mockRes();
      await kioskController.checkout(reqFor(3, { body: { ticketIds: [1] } }), res); // kiosk 3 is branch B
      expect(res.status).toHaveBeenCalledWith(409); // seat not held by kiosk 3's guest account
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SEAT_NOT_LOCKED' }));
    });
  });

  describe('seat rules', () => {
    it('cannot hold a BOOKED seat', async () => {
      await Ticket.updateOne({ id: 1 }, { $set: { status: 0 } }); // BOOKED
      const res = await holdViaKiosk(1, ['A1']);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SEAT_UNAVAILABLE' }));
      const ticket = await Ticket.findOne({ id: 1 });
      expect(ticket.status).toBe(0); // untouched
    });

    it('marks held_by_me only for this kiosk’s own holds', async () => {
      await holdViaKiosk(1, ['A1']);
      const res = mockRes();
      await kioskController.listSeats(reqFor(2, { params: { scheduleId: '1' } }), res); // different kiosk
      const seats = res.json.mock.calls[0][0];
      expect(seats.find((s) => s.seat_code === 'A1').held_by_me).toBe(false);
    });
  });

  describe('concurrent seat selection', () => {
    it('lets exactly one of two kiosks win the same seat', async () => {
      const [r1, r2] = await Promise.all([holdViaKiosk(1, ['A2']), holdViaKiosk(2, ['A2'])]);

      // The winner calls res.json({ held: [...] }) and never res.status; the loser calls
      // res.status(409). Exactly one of each.
      const outcomes = [r1, r2].map((res) => {
        if (res.status.mock.calls.length > 0) return res.status.mock.calls[0][0];
        return res.json.mock.calls[0][0].held?.length > 0 ? 'HELD' : 'UNKNOWN';
      });
      expect(outcomes.filter((o) => o === 'HELD')).toHaveLength(1);
      expect(outcomes.filter((o) => o === 409)).toHaveLength(1);

      const ticket = await Ticket.findOne({ id: 2 });
      expect([901, 902]).toContain(ticket.held_by);
    });
  });

  describe('pricing is server-authoritative', () => {
    it('ignores any price-like fields in the request body', async () => {
      await holdViaKiosk(1, ['A1', 'A2']);
      const res = mockRes();
      await kioskController.quote(
        reqFor(1, { body: { ticketIds: [1, 2], totalPrice: 1, discountAmount: 999999, seatTotal: 1 } }),
        res,
      );
      const body = res.json.mock.calls[0][0];
      expect(body.totalPrice).toBe(200000); // 2 x basePrice 100000
      expect(body.discountAmount).toBe(0);
    });
  });

  describe('checkout never issues a ticket before payment', () => {
    it('creates a PENDING booking + PENDING payment, no invoices, seats still HELD', async () => {
      await holdViaKiosk(1, ['A1', 'A2']);
      const res = mockRes();
      await kioskController.checkout(reqFor(1, { body: { ticketIds: [1, 2] } }), res);
      expect(res.status).toHaveBeenCalledWith(201);
      const { code } = res.json.mock.calls[0][0];

      const booking = await Booking.findOne({ code });
      expect(booking.status).toBe('PENDING');
      const payment = await Payment.findOne({ code });
      expect(payment.status).toBe('PENDING');
      expect(payment.type).toBe('KIOSK');
      expect(await Invoice.countDocuments({ code })).toBe(0);
      const tickets = await Ticket.find({ id: { $in: [1, 2] } });
      expect(tickets.every((t) => t.status === 2)).toBe(true); // HELD
    });
  });

  describe('payment FAILURE releases the seats', () => {
    it('marks payment FAILED, booking not PAID, seats back to AVAILABLE, no invoices', async () => {
      await holdViaKiosk(1, ['A1', 'A2']);
      const checkoutRes = mockRes();
      await kioskController.checkout(reqFor(1, { body: { ticketIds: [1, 2] } }), checkoutRes);
      const { code } = checkoutRes.json.mock.calls[0][0];

      const res = mockRes();
      await kioskController.confirmPayment(
        reqFor(1, { params: { code }, body: { outcome: 'FAILURE' } }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ paid: false }));

      expect((await Payment.findOne({ code })).status).toBe('FAILED');
      expect((await Booking.findOne({ code })).status).toBe('CANCELLED');
      const tickets = await Ticket.find({ id: { $in: [1, 2] } });
      expect(tickets.every((t) => t.status === 1 && t.held_by === null)).toBe(true);
      expect(await Invoice.countDocuments({ code })).toBe(0);
    });
  });

  describe('payment SUCCESS issues the tickets', () => {
    it('marks payment PAID, booking PAID, issues invoices with QR tokens, seats BOOKED', async () => {
      await holdViaKiosk(1, ['A1', 'A2']);
      const checkoutRes = mockRes();
      await kioskController.checkout(reqFor(1, { body: { ticketIds: [1, 2] } }), checkoutRes);
      const { code } = checkoutRes.json.mock.calls[0][0];

      const res = mockRes();
      await kioskController.confirmPayment(
        reqFor(1, { params: { code }, body: { outcome: 'SUCCESS', method: 'QR_PAYMENT' } }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);

      expect((await Payment.findOne({ code })).status).toBe('PAID');
      expect((await Booking.findOne({ code })).status).toBe('PAID');
      const invoices = await Invoice.find({ code });
      expect(invoices).toHaveLength(2);
      expect(invoices.every((inv) => Boolean(inv.qr_token))).toBe(true);
      const tickets = await Ticket.find({ id: { $in: [1, 2] } });
      expect(tickets.every((t) => t.status === 0)).toBe(true); // BOOKED

      const ticketsRes = mockRes();
      await kioskController.bookingTickets(reqFor(1, { params: { code } }), ticketsRes);
      const payload = ticketsRes.json.mock.calls[0][0];
      expect(payload.tickets).toHaveLength(2);
    });

    it('is idempotent on a repeated confirm', async () => {
      await holdViaKiosk(1, ['A1']);
      const checkoutRes = mockRes();
      await kioskController.checkout(reqFor(1, { body: { ticketIds: [1] } }), checkoutRes);
      const { code } = checkoutRes.json.mock.calls[0][0];

      await kioskController.confirmPayment(reqFor(1, { params: { code }, body: { outcome: 'SUCCESS' } }), mockRes());
      const res = mockRes();
      await kioskController.confirmPayment(reqFor(1, { params: { code }, body: { outcome: 'SUCCESS' } }), res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ paid: true, alreadyProcessed: true }));
      expect(await Invoice.countDocuments({ code })).toBe(1);
    });
  });

  describe('checkout idempotency', () => {
    it('returns the same booking for a repeated Idempotency-Key', async () => {
      await holdViaKiosk(1, ['A1', 'A2']);
      const first = mockRes();
      await kioskController.checkout(
        reqFor(1, { body: { ticketIds: [1, 2] }, headers: { 'idempotency-key': 'abc-123' } }),
        first,
      );
      const second = mockRes();
      await kioskController.checkout(
        reqFor(1, { body: { ticketIds: [1, 2] }, headers: { 'idempotency-key': 'abc-123' } }),
        second,
      );
      expect(first.json.mock.calls[0][0].code).toBe(second.json.mock.calls[0][0].code);
      expect(await Payment.countDocuments({ code: first.json.mock.calls[0][0].code })).toBe(1);
    });
  });

  describe('timeout (reuses expireStalePendingBookings)', () => {
    it('expires an abandoned PENDING kiosk booking and releases its seats', async () => {
      await holdViaKiosk(1, ['A1', 'A2']);
      const checkoutRes = mockRes();
      await kioskController.checkout(reqFor(1, { body: { ticketIds: [1, 2] } }), checkoutRes);
      const { code } = checkoutRes.json.mock.calls[0][0];

      await Booking.updateOne({ code }, { $set: { expires_at: new Date(Date.now() - 1000) } });
      await bookingRepository.expireStalePendingBookings();

      expect((await Booking.findOne({ code })).status).toBe('EXPIRED');
      const tickets = await Ticket.find({ id: { $in: [1, 2] } });
      expect(tickets.every((t) => t.status === 1)).toBe(true);
    });

    it('does not issue tickets for a late SUCCESS on an already-expired booking — flags it for refund', async () => {
      await holdViaKiosk(1, ['A1', 'A2']);
      const checkoutRes = mockRes();
      await kioskController.checkout(reqFor(1, { body: { ticketIds: [1, 2] } }), checkoutRes);
      const { code } = checkoutRes.json.mock.calls[0][0];

      await Booking.updateOne({ code }, { $set: { expires_at: new Date(Date.now() - 1000) } });
      await bookingRepository.expireStalePendingBookings();

      const res = mockRes();
      await kioskController.confirmPayment(reqFor(1, { params: { code }, body: { outcome: 'SUCCESS' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ needsRefund: true, reason: 'BOOKING_EXPIRED' }));
      expect(await Invoice.countDocuments({ code })).toBe(0);
      expect((await Payment.findOne({ code })).status).toBe('REFUND_PENDING');
      expect((await Booking.findOne({ code })).status).toBe('EXPIRED');
    });
  });
});
