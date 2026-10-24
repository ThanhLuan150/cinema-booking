// Runs against a single-node REPLICA SET, so createPending and finalizePaid execute inside real MongoDB
// transactions. The compensation helpers only ever run without a session, so they are spied on here to
// prove that whatever was undone, the transaction abort undid it.
jest.mock('../utils/socket');

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, range, seedGroupWorld } = require('../../tests/groupBookingFixtures');
const groupBookingRepository = require('./groupBooking.repository');
const bookingRepository = require('./booking.repository');
const Booking = require('../models/Booking');
const Counter = require('../models/Counter');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const { supportsTransactions, resetTransactionSupportCache } = require('../utils/withTransaction');

beforeAll(async () => {
  await connect({ replSet: true });
  // Collections (and their unique indexes) must exist before a transaction writes to them.
  for (const model of [Booking, Invoice, Payment, Ticket, Counter]) {
    await model.init();
    await model.createCollection();
  }
  resetTransactionSupportCache();
});
let errorSpy;
beforeEach(async () => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await seedGroupWorld({ withRbac: false });
});
afterEach(async () => {
  jest.restoreAllMocks();
  errorSpy.mockRestore();
  await clearDatabase();
});
afterAll(async () => closeDatabase());

const TEN = range(1, 10);
const PRICING = { voucherCode: null, promotionCode: null, discountAmount: 0, seatTotal: 1000000, comboTotal: 0, totalPrice: 1000000 };
const GROUP = { organizer_type: 'CUSTOMER', group_name: 'Friends' };
let codeSeq = 0;

async function createPending({ accountId = ID.LAN, ticketIds = TEN, idempotencyKey = null, code } = {}) {
  codeSeq += 1;
  return groupBookingRepository.createPending({
    code: code || `GB-T${codeSeq}`,
    accountId,
    schedule: await Schedule.findOne({ id: ID.SHOWTIME }),
    ticketIds,
    comboIds: [],
    pricing: PRICING,
    group: GROUP,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    idempotencyKey,
  });
}

const heldFor = async (code) => (await Ticket.find({ status: Ticket.STATUS.HELD, hold_booking_code: code })).map((t) => t.id).sort((a, b) => a - b);

it('detects the replica set', async () => {
  expect(await supportsTransactions()).toBe(true);
});

describe('createPending in a real transaction', () => {
  it('commits the booking, every seat claim and the payment together', async () => {
    const claimSpy = jest.spyOn(bookingRepository, 'claimSeatForGroup');

    const result = await createPending({ code: 'GB-OK' });

    expect(result.booking.status).toBe('PENDING');
    expect(result.payment.amount).toBe(1000000);
    expect(claimSpy).toHaveBeenCalledTimes(10);
    for (const [args] of claimSpy.mock.calls) expect(args.session).toBeTruthy();
    expect(await heldFor('GB-OK')).toEqual(TEN);
    expect(await Payment.countDocuments({ code: 'GB-OK' })).toBe(1);
  });

  it('a taken seat rolls EVERYTHING back — no booking, no payment, no seat left claimed, holds restored', async () => {
    // Lan held A1 on the seat map before deciding to book for the group; Minh holds A7.
    const lanHoldUntil = new Date(Date.now() + 60000);
    await Ticket.updateOne({ id: 1 }, { $set: { status: Ticket.STATUS.HELD, held_by: ID.LAN, held_until: lanHoldUntil } });
    await Ticket.updateOne({ id: 7 }, { $set: { status: Ticket.STATUS.HELD, held_by: ID.MINH, held_until: lanHoldUntil } });
    const compensation = jest.spyOn(bookingRepository, 'restoreGroupClaims');

    const result = await createPending({ code: 'GB-CONFLICT' });

    expect(result).toEqual({ conflict: [7] });
    expect(compensation).not.toHaveBeenCalled(); // the abort did it
    expect(await Booking.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
    expect(await heldFor('GB-CONFLICT')).toEqual([]);
    expect(await Ticket.findOne({ id: 1 })).toMatchObject({ status: Ticket.STATUS.HELD, held_by: ID.LAN, hold_booking_code: null });
    expect((await Ticket.findOne({ id: 1 })).held_until.getTime()).toBe(lanHoldUntil.getTime());
    expect(await Ticket.countDocuments({ id: { $in: [2, 3, 4, 5, 6, 8, 9, 10] }, status: Ticket.STATUS.AVAILABLE })).toBe(8);
  });

  it('a failure after the seats were claimed (writing the payment) rolls back the claims and the booking', async () => {
    jest.spyOn(Payment, 'create').mockRejectedValueOnce(new Error('connection reset'));

    await expect(createPending({ code: 'GB-BOOM' })).rejects.toThrow('connection reset');

    expect(await Booking.countDocuments()).toBe(0);
    expect(await Ticket.countDocuments({ status: Ticket.STATUS.HELD })).toBe(0);

    // ...and the same order goes through afterwards.
    const retry = await createPending({ code: 'GB-BOOM2' });
    expect(await heldFor('GB-BOOM2')).toEqual(TEN);
    expect(retry.booking.code).toBe('GB-BOOM2');
  });

  it('two overlapping checkouts racing: exactly one commits, the other claims nothing', async () => {
    const [a, b] = await Promise.all([
      createPending({ accountId: ID.LAN, ticketIds: range(1, 10), code: 'GB-A' }),
      createPending({ accountId: ID.MINH, ticketIds: range(6, 15), code: 'GB-B' }),
    ]);

    const winners = [a, b].filter((r) => r.booking);
    expect(winners).toHaveLength(1);
    const loser = a.booking ? b : a;
    expect(loser.conflict.length).toBeGreaterThan(0);
    expect(await Booking.countDocuments()).toBe(1);
    const held = await Ticket.find({ status: Ticket.STATUS.HELD });
    expect(new Set(held.map((t) => t.hold_booking_code))).toEqual(new Set([winners[0].booking.code]));
    expect(held).toHaveLength(10);
  });

  it('concurrent requests with the same idempotency key: one booking, the rest are told it exists', async () => {
    const results = await Promise.all(range(1, 4).map(() => createPending({ idempotencyKey: 'same-key' })));

    expect(results.filter((r) => r.booking)).toHaveLength(1);
    expect(results.filter((r) => r.duplicateKey)).toHaveLength(3);
    expect(await Booking.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(1);
    expect(await Ticket.countDocuments({ status: Ticket.STATUS.HELD })).toBe(10);
  });
});

describe('finalizePaid in a real transaction', () => {
  it('issues one ticket per seat and books every seat in one commit', async () => {
    await createPending({ code: 'GB-PAY' });
    const bookSpy = jest.spyOn(bookingRepository, 'bookSeatForGroup');

    const result = await groupBookingRepository.finalizePaid('GB-PAY');

    expect(result.issued).toBe(true);
    for (const [args] of bookSpy.mock.calls) expect(args.session).toBeTruthy();
    expect(await Invoice.countDocuments({ code: 'GB-PAY' })).toBe(10);
    expect(await Ticket.countDocuments({ id: { $in: TEN }, status: Ticket.STATUS.BOOKED })).toBe(10);
    expect((await Booking.findOne({ code: 'GB-PAY' })).status).toBe('PAID');
  });

  it('a failure while writing the 4th ticket rolls back the PAID flip, the seats and the first three tickets', async () => {
    await createPending({ code: 'GB-HALF' });
    const realCreate = Invoice.create.bind(Invoice);
    let calls = 0;
    jest.spyOn(Invoice, 'create').mockImplementation(async (...args) => {
      calls += 1;
      if (calls === 4) throw new Error('disk on fire');
      return realCreate(...args);
    });
    const compensation = jest.spyOn(bookingRepository, 'restoreBookedGroupSeats');

    await expect(groupBookingRepository.finalizePaid('GB-HALF')).rejects.toThrow('disk on fire');

    expect(compensation).not.toHaveBeenCalled();
    expect(await Invoice.countDocuments()).toBe(0);
    expect((await Booking.findOne({ code: 'GB-HALF' })).status).toBe('PENDING');
    expect(await heldFor('GB-HALF')).toEqual(TEN);

    // The retried confirmation finishes the job, once.
    jest.restoreAllMocks();
    expect((await groupBookingRepository.finalizePaid('GB-HALF')).issued).toBe(true);
    expect((await groupBookingRepository.finalizePaid('GB-HALF')).alreadyPaid).toBe(true);
    expect(await Invoice.countDocuments({ code: 'GB-HALF' })).toBe(10);
  });

  it('a seat lost after the hold lapsed: nothing is issued, the booking is cancelled and its other seats freed', async () => {
    await createPending({ code: 'GB-LOST' });
    await Ticket.updateOne({ id: 8 }, { $set: { held_by: ID.MINH, hold_booking_code: null } }); // A8 is Minh's now

    const result = await groupBookingRepository.finalizePaid('GB-LOST');

    expect(result.seatsLost).toEqual([8]);
    expect((await Booking.findOne({ code: 'GB-LOST' })).status).toBe('CANCELLED');
    expect(await Invoice.countDocuments()).toBe(0);
    expect(await Ticket.countDocuments({ status: Ticket.STATUS.BOOKED })).toBe(0);
    expect(await Ticket.findOne({ id: 8 })).toMatchObject({ status: Ticket.STATUS.HELD, held_by: ID.MINH });
    expect(await Ticket.countDocuments({ id: { $in: [1, 2, 3, 4, 5, 6, 7, 9, 10] }, status: Ticket.STATUS.AVAILABLE })).toBe(9);
  });

  it('concurrent confirmations: exactly one issues the tickets, the others see them already paid', async () => {
    await createPending({ code: 'GB-RACE' });

    const results = await Promise.all(range(1, 5).map(() => groupBookingRepository.finalizePaid('GB-RACE')));

    expect(results.filter((r) => r.issued)).toHaveLength(1);
    expect(results.filter((r) => r.alreadyPaid)).toHaveLength(4);
    const invoices = await Invoice.find({ code: 'GB-RACE' });
    expect(invoices).toHaveLength(10);
    expect(new Set(invoices.map((i) => i.issue_key)).size).toBe(10);
  });

  it('a booking cancelled before the money arrived is reported as not payable and left untouched', async () => {
    await createPending({ code: 'GB-GONE' });
    await bookingRepository.cancelPendingGroupBooking('GB-GONE', { reason: 'Cancelled by customer' });

    const result = await groupBookingRepository.finalizePaid('GB-GONE');

    expect(result.notPayable).toBe(true);
    expect(result.booking.status).toBe('CANCELLED');
    expect(await Invoice.countDocuments()).toBe(0);
  });
});
