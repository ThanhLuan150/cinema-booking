jest.mock('../utils/mailer', () =>
  Object.fromEntries(
    Object.keys(jest.requireActual('../utils/mailer')).map((name) => [name, jest.fn().mockResolvedValue({})]),
  ),
);

const axios = require('axios');
const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, PRICE, auth, as, seatId, seatIds, range, seedGroupWorld, seedGroupPromotions } = require('../../tests/groupBookingFixtures');
const { errorHandler } = require('../middleware/errorHandler');
const groupBookingRoutes = require('./groupBooking.routes');
const bookingRoutes = require('./booking.routes');
const bookingRepository = require('../repositories/booking.repository');
const systemConfigService = require('../services/systemConfig.service');
const AuditLog = require('../models/AuditLog');
const Booking = require('../models/Booking');
const ComboOrder = require('../models/ComboOrder');
const Inventory = require('../models/Inventory');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PointsTransaction = require('../models/PointsTransaction');
const Promotion = require('../models/Promotion');
const PromotionUsage = require('../models/PromotionUsage');
const Schedule = require('../models/Schedule');
const Seat = require('../models/Seat');
const Ticket = require('../models/Ticket');

const app = express();
app.use(express.json());
app.use('/api/group-bookings', groupBookingRoutes);
app.use('/api', bookingRoutes);
app.use(errorHandler);

const ORIGINAL_ENV = process.env;
let logSpy;
let errorSpy;
beforeAll(async () => {
  await connect();
  // The unique indexes (idempotency_key, issue_key) must exist before the first race, not lazily.
  await Promise.all([Booking.init(), Invoice.init(), Payment.init(), PromotionUsage.init(), PointsTransaction.init()]);
});
beforeEach(async () => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env = { ...ORIGINAL_ENV };
  for (const key of ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY']) delete process.env[key];
  systemConfigService.invalidateAll();
  await seedGroupWorld();
  await seedGroupPromotions();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
  systemConfigService.invalidateAll();
  jest.clearAllMocks();
  logSpy.mockRestore();
  errorSpy.mockRestore();
});
afterAll(async () => {
  process.env = ORIGINAL_ENV;
  await closeDatabase();
});

const TEN = range(1, 10); // A1..A10, regular
const COMPANY = {
  organizer_type: 'COMPANY',
  company_name: 'Acme Vietnam JSC',
  tax_code: '0101234567',
  contact_name: 'Lan Nguyen',
  contact_email: 'events@acme.vn',
  contact_phone: '+84 901 234 567',
  group_name: 'Q4 team outing',
};
const order = (overrides = {}) => ({
  schedule_id: ID.SHOWTIME,
  ticket_ids: TEN,
  combos: [
    { combo_id: ID.POPCORN, quantity: 5 },
    { combo_id: ID.DRINK, quantity: 10 },
  ],
  organizer: COMPANY,
  ...overrides,
});
// 10 x 100,000 + 5 x 50,000 + 10 x 30,000 = 1,550,000; GROUP10 (10%) beats GROUP5 (5%).
const ORDER_VALUE = 10 * PRICE.REGULAR + 5 * 50000 + 10 * 30000;
const GROUP10_DISCOUNT = ORDER_VALUE * 0.1;
const TOTAL = ORDER_VALUE - GROUP10_DISCOUNT;

const quote = (body = order(), who = auth.lan) =>
  request(app).post('/api/group-bookings/quote').set('Authorization', who()).send(body);
function checkout(body = order(), { who = auth.lan, key = null } = {}) {
  let req = request(app).post('/api/group-bookings').set('Authorization', who());
  if (key) req = req.set('Idempotency-Key', key);
  return req.send(body);
}
const ipn = (code, resultCode = 0) =>
  request(app)
    .post('/api/MomoPayment/ipn')
    .send({ orderId: code, resultCode, transId: resultCode === 0 ? `T-${code}` : undefined, message: 'm', extraData: '' });
const browserConfirm = (code, resultCode = 0, who = auth.lan) =>
  request(app)
    .post(`/api/group-bookings/${code}/momo-confirm`)
    .set('Authorization', who())
    .send({ orderId: code, resultCode, transId: resultCode === 0 ? `T-${code}` : undefined, message: 'm', extraData: '' });

const tickets = (ids) => Ticket.find({ id: { $in: ids } }).sort({ id: 1 });
const heldBy = async (accountId) => (await Ticket.find({ status: Ticket.STATUS.HELD, held_by: accountId })).map((t) => t.id).sort((a, b) => a - b);

async function placeAndPay(body = order()) {
  const res = await checkout(body);
  expect(res.status).toBe(201);
  const { code } = res.body.booking;
  expect((await ipn(code)).status).toBe(200);
  return code;
}

describe('quote', () => {
  it('prices every seat and combo line and applies the best group promotion — without writing anything', async () => {
    const res = await quote();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      seat_count: 10,
      seat_total: 10 * PRICE.REGULAR,
      combo_total: 550000,
      order_value: ORDER_VALUE,
      discount: { source: 'GROUP_PROMOTION', code: 'GROUP10', amount: GROUP10_DISCOUNT, min_tickets: 10 },
      total_price: TOTAL,
      unavailable_seat_codes: [],
      limits: { min_seats: 2, max_seats: 50 },
    });
    expect(res.body.combos).toEqual([
      { combo_id: ID.POPCORN, name: 'Popcorn', type: 'FOOD', unit_price: 50000, quantity: 5, line_total: 250000 },
      { combo_id: ID.DRINK, name: 'Drink', type: 'BEVERAGE', unit_price: 30000, quantity: 10, line_total: 300000 },
    ]);
    expect(await Booking.countDocuments()).toBe(0);
    expect(await Ticket.countDocuments({ status: { $ne: Ticket.STATUS.AVAILABLE } })).toBe(0);
  });

  it('prices VIP seats through the pricing engine and picks the promotion the group size qualifies for', async () => {
    const res = await quote(order({ ticket_ids: seatIds('B1', 'B2', 'A1', 'A2', 'A3', 'A4'), combos: [] }));

    expect(res.status).toBe(200);
    expect(res.body.seat_total).toBe(2 * PRICE.VIP + 4 * PRICE.REGULAR);
    expect(res.body.seats.find((s) => s.seat_code === 'B1').price).toBe(PRICE.VIP);
    // 6 tickets: GROUP10 needs 10, so GROUP5 is the best that applies.
    expect(res.body.discount).toMatchObject({ source: 'GROUP_PROMOTION', code: 'GROUP5' });
  });

  it('applies no discount to a group below every promotion minimum', async () => {
    const res = await quote(order({ ticket_ids: [1, 2, 3], combos: [] }));
    expect(res.body.discount).toBeNull();
    expect(res.body.total_price).toBe(3 * PRICE.REGULAR);
  });

  it('a typed promotion code replaces the automatic one; a group code below its ticket minimum is refused', async () => {
    const typed = await quote(order({ promotion_code: 'summer' }));
    expect(typed.body.discount).toMatchObject({ source: 'PROMOTION_CODE', code: 'SUMMER', amount: 20000 });

    const tooFew = await quote(order({ ticket_ids: [1, 2, 3, 4, 5, 6], promotion_code: 'GROUP10' }));
    expect(tooFew.status).toBe(400);
    expect(tooFew.body).toMatchObject({ code: 'PROMOTION_MIN_TICKETS_NOT_MET', minTickets: 10 });
  });

  it('ignores a group promotion that is inactive, expired or used up by this customer', async () => {
    await Promotion.updateOne({ code: 'GROUP10' }, { $set: { per_customer_limit: 1 } });
    await PromotionUsage.create({ promotion_id: 1, account_id: ID.LAN, count: 1 });
    await Promotion.updateOne({ code: 'GROUP5' }, { $set: { status: 'INACTIVE' } });

    const res = await quote();
    expect(res.body.discount).toBeNull();
  });

  it('reports seats the caller cannot take and combo stock shortfalls instead of refusing', async () => {
    await Ticket.updateOne({ id: 3 }, { $set: { status: Ticket.STATUS.HELD, held_by: ID.MINH, held_until: new Date(Date.now() + 60000) } });
    await Inventory.create({ id: 1, branch_id: ID.BRANCH_1, combo_id: ID.POPCORN, item: 'Popcorn', quantity: 2 });

    const res = await quote();
    expect(res.status).toBe(200);
    expect(res.body.unavailable_seat_codes).toEqual(['A3']);
    expect(res.body.stock_shortages).toEqual([expect.objectContaining({ combo_id: ID.POPCORN, requested: 5, available: 2 })]);
  });
});

describe('validation', () => {
  it('refuses seats from more than one showtime (and holds nothing)', async () => {
    const res = await checkout(order({ ticket_ids: [1, 2, 3, 101, 102] }));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'SEATS_NOT_SAME_SHOWTIME', ticketIds: [101, 102] });
    expect(await Ticket.countDocuments({ status: Ticket.STATUS.HELD })).toBe(0);
    expect(await Booking.countDocuments()).toBe(0);
  });

  it('the regular MoMo checkout refuses seats from two showtimes too (it used to look at the first seat only)', async () => {
    const res = await request(app)
      .post('/api/MomoPayment')
      .set('Authorization', auth.lan())
      .send({ ticketIds: [1, 101] });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'SEATS_NOT_SAME_SHOWTIME', ticketIds: [101] });
    expect(await Booking.countDocuments()).toBe(0);
  });

  it('refuses a group below the minimum / above the maximum size (both configurable per branch)', async () => {
    expect((await checkout(order({ ticket_ids: [1] }))).body).toMatchObject({ code: 'GROUP_TOO_SMALL', minSeats: 2 });

    await systemConfigService.setValue({ key: 'GROUP_BOOKING_MAX_SEATS', branchId: ID.BRANCH_1, value: 8, accountId: 1 });
    const res = await checkout();
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'GROUP_TOO_LARGE', maxSeats: 8 });
  });

  it('is not limited by the regular per-booking seat cap', async () => {
    // MAX_BOOKING_SEATS defaults to 8; a group of 15 still goes through.
    const res = await checkout(order({ ticket_ids: range(1, 15), combos: [] }));
    expect(res.status).toBe(201);
    expect(res.body.booking.seats).toHaveLength(15);
  });

  it.each([
    ['a seat listed twice', { ticket_ids: [1, 2, 2] }, 400, 'DUPLICATE_SEATS'],
    ['an unknown seat', { ticket_ids: [1, 2, 9999] }, 404, 'SEAT_NOT_FOUND'],
    ['a price in the body', { total_price: 1 }, 400, 'GROUP_PRICE_READONLY'],
    ['a retired combo', { combos: [{ combo_id: ID.RETIRED, quantity: 1 }] }, 400, 'COMBO_NOT_AVAILABLE'],
    ["another branch's combo", { combos: [{ combo_id: ID.NACHOS, quantity: 1 }] }, 400, 'COMBO_NOT_AVAILABLE'],
    ['a zero combo quantity', { combos: [{ combo_id: ID.POPCORN, quantity: 0 }] }, 400, 'INVALID_COMBO_LINE'],
    ['a company without its name', { organizer: { organizer_type: 'COMPANY' } }, 400, 'COMPANY_NAME_REQUIRED'],
    ['a malformed tax code', { organizer: { ...COMPANY, tax_code: '12AB' } }, 400, 'INVALID_TAX_CODE'],
    ['both a voucher and a promotion', { voucher_code: 'V', promotion_code: 'P' }, 400, 'DISCOUNT_CONFLICT'],
    ['no showtime', { schedule_id: undefined }, 400, 'SCHEDULE_REQUIRED'],
  ])('refuses %s', async (_label, overrides, status, code) => {
    const res = await checkout(order(overrides));
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
    expect(await Ticket.countDocuments({ status: Ticket.STATUS.HELD })).toBe(0);
  });

  it('refuses a seat taken out of service on the room map', async () => {
    await Seat.updateOne({ room_id: ID.ROOM, seat_code: 'A4' }, { $set: { status: 'DISABLED' } });
    const res = await checkout();
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'SEAT_DISABLED', seatCodes: ['A4'] });
  });

  it('refuses a cancelled or already-started showtime', async () => {
    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { status: 'CANCELLED' } });
    expect((await checkout()).body.code).toBe('SCHEDULE_CANCELLED');

    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { status: 'ACTIVE', movie_date: '2020-01-01' } });
    expect((await checkout()).body.code).toBe('SHOWTIME_STARTED');
  });

  it('needs a signed-in customer', async () => {
    expect((await request(app).post('/api/group-bookings').send(order())).status).toBe(401);
  });
});

describe('checkout and successful payment', () => {
  it('claims every seat for one PENDING booking with one payment for the whole order', async () => {
    const res = await checkout();

    expect(res.status).toBe(201);
    const { booking } = res.body;
    expect(booking).toMatchObject({
      booking_type: 'GROUP',
      status: 'PENDING',
      seat_total: 10 * PRICE.REGULAR,
      combo_total: 550000,
      discount_amount: GROUP10_DISCOUNT,
      promotion_code: 'GROUP10',
      total_price: TOTAL,
      group: { organizer_type: 'COMPANY', company_name: 'Acme Vietnam JSC', tax_code: '0101234567', auto_discount: true },
    });
    expect(res.body.pay_url).toContain(`orderId=${booking.code}`);
    expect(res.body.pay_url).toContain('/GroupBooking/PaymentResult');

    for (const t of await tickets(TEN)) {
      expect(t).toMatchObject({ status: Ticket.STATUS.HELD, held_by: ID.LAN, hold_booking_code: booking.code });
    }
    const payments = await Payment.find();
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ code: booking.code, amount: TOTAL, status: 'PENDING', type: 'ONLINE', method: 'MOMO' });
    expect(await AuditLog.countDocuments({ action: 'CREATE_BOOKING', entity_id: booking.id })).toBe(1);
  });

  it('issues exactly one ticket per seat when the payment succeeds, with the combos and the discount recorded once', async () => {
    const code = await placeAndPay();

    const booking = await Booking.findOne({ code });
    expect(booking.status).toBe('PAID');
    const invoices = await Invoice.find({ booking_id: booking.id }).sort({ ticket_id: 1 });
    expect(invoices.map((i) => i.ticket_id)).toEqual(TEN);
    expect(new Set(invoices.map((i) => i.qr_token)).size).toBe(10);
    expect(invoices.every((i) => i.ticket_status === 'ISSUED')).toBe(true);
    // The whole payment is spread over the tickets — nothing lost, nothing added.
    expect(invoices.reduce((sum, i) => sum + i.total_price, 0)).toBe(TOTAL);

    for (const t of await tickets(TEN)) {
      expect(t).toMatchObject({ status: Ticket.STATUS.BOOKED, held_by: null, hold_booking_code: null });
    }
    expect((await Payment.findOne({ code })).status).toBe('PAID');

    const comboOrders = await ComboOrder.find({ booking_id: booking.id });
    expect(comboOrders).toHaveLength(1);
    expect(comboOrders[0].items.map(({ combo_id, quantity }) => ({ combo_id, quantity }))).toEqual([
      { combo_id: ID.POPCORN, quantity: 5 },
      { combo_id: ID.DRINK, quantity: 10 },
    ]);
    expect((await Promotion.findOne({ code: 'GROUP10' })).used_count).toBe(1);
    expect(await PointsTransaction.countDocuments({ booking_id: booking.id })).toBe(1);
  });

  it('shows the paid group booking with its tickets to its customer and to an admin, but not to anyone else', async () => {
    const code = await placeAndPay();

    const own = await request(app).get(`/api/group-bookings/${code}`).set('Authorization', auth.lan());
    expect(own.status).toBe(200);
    expect(own.body.tickets).toHaveLength(10);
    expect(own.body.combos).toEqual([
      expect.objectContaining({ combo_id: ID.POPCORN, quantity: 5 }),
      expect.objectContaining({ combo_id: ID.DRINK, quantity: 10 }),
    ]);

    expect((await request(app).get(`/api/group-bookings/${code}`).set('Authorization', auth.superAdmin())).status).toBe(200);
    expect((await request(app).get(`/api/group-bookings/${code}`).set('Authorization', auth.minh())).status).toBe(404);
  });

  it("a seat bound to the customer's own pending group cannot be checked out again through the regular flow", async () => {
    await checkout();

    const regular = await request(app)
      .post('/api/MomoPayment')
      .set('Authorization', auth.lan())
      .send({ ticketIds: [1, 2] });
    expect(regular.status).toBe(409);
    expect(regular.body).toMatchObject({ code: 'SEAT_UNAVAILABLE', ticketIds: [1, 2] });

    // ...nor re-held, nor released from the seat map.
    const hold = await request(app).post(`/api/bookseat/${ID.SHOWTIME}/hold`).set('Authorization', auth.lan()).send({ seatCodes: ['A1'] });
    expect(hold.status).toBe(409);
    await request(app).post(`/api/bookseat/${ID.SHOWTIME}/release`).set('Authorization', auth.lan()).send({ seatCodes: ['A1'] });
    expect((await Ticket.findOne({ id: 1 })).hold_booking_code).toMatch(/^GB-/);
  });

  it("takes over the customer's own seat-map holds", async () => {
    await request(app).post(`/api/bookseat/${ID.SHOWTIME}/hold`).set('Authorization', auth.lan()).send({ seatCodes: ['A1', 'A2'] });

    const res = await checkout();
    expect(res.status).toBe(201);
    expect((await Ticket.findOne({ id: 1 })).hold_booking_code).toBe(res.body.booking.code);
  });
});

describe('payment failure releases every seat', () => {
  it('cancels the booking, fails the payment and frees all ten seats at once', async () => {
    const { body } = await checkout();
    const { code } = body.booking;

    const res = await ipn(code, 1006);
    expect(res.status).toBe(200);

    expect(await Booking.findOne({ code })).toMatchObject({ status: 'CANCELLED', cancel_reason: 'Payment failed' });
    expect((await Payment.findOne({ code })).status).toBe('FAILED');
    for (const t of await tickets(TEN)) {
      expect(t).toMatchObject({ status: Ticket.STATUS.AVAILABLE, held_by: null, hold_booking_code: null });
    }
    expect(await Invoice.countDocuments()).toBe(0);
    expect(await ComboOrder.countDocuments()).toBe(0);
    expect((await Promotion.findOne({ code: 'GROUP10' })).used_count).toBe(0);

    // Someone else can book those seats straight away.
    expect((await checkout(order(), { who: auth.minh })).status).toBe(201);
  });

  it("never frees a seat that already became someone else's after the group's hold lapsed", async () => {
    const { body } = await checkout();
    const { code } = body.booking;
    // A1's hold lapsed and Minh took it on the seat map.
    await Ticket.updateOne(
      { id: 1 },
      { $set: { status: Ticket.STATUS.HELD, held_by: ID.MINH, held_until: new Date(Date.now() + 60000), hold_booking_code: null } },
    );

    await ipn(code, 1006);

    expect(await Ticket.findOne({ id: 1 })).toMatchObject({ status: Ticket.STATUS.HELD, held_by: ID.MINH });
    expect(await heldBy(ID.LAN)).toEqual([]);
  });

  it("the customer's browser reporting the failure releases the seats just the same", async () => {
    const { body } = await checkout();

    const res = await browserConfirm(body.booking.code, 1006);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, booking: { status: 'CANCELLED' } });
    expect(await heldBy(ID.LAN)).toEqual([]);
  });

  it('a payment link that cannot be created releases the seats immediately', async () => {
    Object.assign(process.env, { MOMO_PARTNER_CODE: 'P', MOMO_ACCESS_KEY: 'A', MOMO_SECRET_KEY: 'S' });
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('gateway down'));

    const res = await checkout();

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
    expect(await Booking.findOne()).toMatchObject({ status: 'CANCELLED' });
    expect((await Payment.findOne()).status).toBe('FAILED');
    expect(await heldBy(ID.LAN)).toEqual([]);
  });
});

describe('retries never create duplicate tickets', () => {
  it('the same payment confirmation arriving again and again (IPN retries + browser) issues the tickets once', async () => {
    const code = await placeAndPay();

    for (let i = 0; i < 3; i += 1) expect((await ipn(code)).status).toBe(200);
    const confirm = await browserConfirm(code);
    expect(confirm.body).toMatchObject({ success: true, already_processed: true });

    const booking = await Booking.findOne({ code });
    expect(await Invoice.countDocuments({ booking_id: booking.id })).toBe(10);
    expect(await ComboOrder.countDocuments({ booking_id: booking.id })).toBe(1);
    expect((await Promotion.findOne({ code: 'GROUP10' })).used_count).toBe(1);
    expect(await PointsTransaction.countDocuments({ booking_id: booking.id })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'TICKET_ISSUED', entity_id: booking.id })).toBe(1);
  });

  it('concurrent confirmations of the same payment issue exactly one set of tickets', async () => {
    const { body } = await checkout();
    const { code } = body.booking;

    const results = await Promise.all([ipn(code), browserConfirm(code), ipn(code), browserConfirm(code), ipn(code), ipn(code)]);
    for (const r of results) expect(r.status).toBe(200);

    const booking = await Booking.findOne({ code });
    expect(booking.status).toBe('PAID');
    const invoices = await Invoice.find({ booking_id: booking.id });
    expect(invoices).toHaveLength(10);
    expect(new Set(invoices.map((i) => i.ticket_id)).size).toBe(10);
    expect(await ComboOrder.countDocuments({ booking_id: booking.id })).toBe(1);
    expect((await Promotion.findOne({ code: 'GROUP10' })).used_count).toBe(1);
  });

  it('a confirmation that fails part-way is undone, and the next one issues every ticket exactly once', async () => {
    const { body } = await checkout();
    const { code } = body.booking;
    const realCreate = Invoice.create.bind(Invoice);
    let calls = 0;
    const spy = jest.spyOn(Invoice, 'create').mockImplementation(async (...args) => {
      calls += 1;
      if (calls === 4) throw new Error('primary stepped down');
      return realCreate(...args);
    });

    const first = await ipn(code);
    expect(first.status).toBe(500);
    // Compensated: no ticket left behind, the booking still PENDING with every seat still held for it.
    expect(await Invoice.countDocuments()).toBe(0);
    expect((await Booking.findOne({ code })).status).toBe('PENDING');
    expect(await heldBy(ID.LAN)).toEqual(TEN);
    expect((await Payment.findOne({ code })).status).toBe('PAID'); // the money did arrive

    spy.mockRestore();
    const retry = await ipn(code); // MoMo retries the IPN / the webhook retry job replays it
    expect(retry.status).toBe(200);
    expect(await Invoice.countDocuments({ code })).toBe(10);
    expect((await Booking.findOne({ code })).status).toBe('PAID');
  });

  it('a duplicate invoice can never be written for the same seat of the same booking', async () => {
    const code = await placeAndPay();
    const existing = await Invoice.findOne({ code });

    await expect(
      Invoice.create({ ...existing.toObject(), _id: undefined, id: 99999, qr_token: 'other' }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('retrying the checkout with the same Idempotency-Key returns the same booking and payment link', async () => {
    const first = await checkout(order(), { key: 'key-1' });
    const second = await checkout(order(), { key: 'key-1' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.booking.code).toBe(first.body.booking.code);
    expect(second.body.pay_url).toBe(first.body.pay_url);
    expect(await Booking.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('concurrent requests with the same Idempotency-Key create one booking', async () => {
    const results = await Promise.all(range(1, 5).map(() => checkout(order(), { key: 'double-click' })));

    expect(await Booking.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(1);
    const succeeded = results.filter((r) => r.status < 300);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(new Set(succeeded.map((r) => r.body.booking.code)).size).toBe(1);
    for (const r of results.filter((x) => x.status >= 300)) expect(r.body.code).toBe('CHECKOUT_IN_PROGRESS');
    expect(await heldBy(ID.LAN)).toEqual(TEN);
  });

  it('refuses an Idempotency-Key reused for a different order', async () => {
    await checkout(order(), { key: 'key-2' });
    const res = await checkout(order({ ticket_ids: [11, 12] }), { key: 'key-2' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await Booking.countDocuments()).toBe(1);
  });
});

describe('concurrency: two groups, one set of seats', () => {
  it('of two overlapping group checkouts exactly one wins, and the loser is left holding nothing', async () => {
    const lan = order({ ticket_ids: range(1, 10), combos: [] }); // A1..A10
    const minh = order({ ticket_ids: range(6, 15), combos: [] }); // A6..B5

    const [a, b] = await Promise.all([checkout(lan, { who: auth.lan }), checkout(minh, { who: auth.minh })]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.code).toBe('SEAT_UNAVAILABLE');
    expect(loser.body.seatCodes.length).toBeGreaterThan(0);

    const winnerId = a.status === 201 ? ID.LAN : ID.MINH;
    const loserId = winnerId === ID.LAN ? ID.MINH : ID.LAN;
    expect(await heldBy(loserId)).toEqual([]);
    expect(await heldBy(winnerId)).toEqual(winnerId === ID.LAN ? range(1, 10) : range(6, 15));
    expect(await Booking.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('many customers racing for the same seats: one booking, every other customer holds nothing', async () => {
    const racers = range(1, 8).map((n) => 500 + n);
    const results = await Promise.all(racers.map((accountId) => checkout(order({ combos: [] }), { who: () => as(1, accountId) })));

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(racers.length - 1);
    expect(await Booking.countDocuments()).toBe(1);
    const held = await Ticket.find({ status: Ticket.STATUS.HELD });
    expect(held).toHaveLength(10);
    expect(new Set(held.map((t) => t.held_by)).size).toBe(1);
  });

  it('a group checkout racing a single seat-map hold: the seat ends up with exactly one of them', async () => {
    const [group, single] = await Promise.all([
      checkout(order({ combos: [] })),
      request(app).post(`/api/bookseat/${ID.SHOWTIME}/hold`).set('Authorization', auth.minh()).send({ seatCodes: ['A5'] }),
    ]);

    const a5 = await Ticket.findOne({ id: seatId('A5') });
    if (group.status === 201) {
      expect(single.status).toBe(409);
      expect(a5.held_by).toBe(ID.LAN);
      expect(await heldBy(ID.LAN)).toEqual(TEN);
    } else {
      expect(group.body).toMatchObject({ code: 'SEAT_UNAVAILABLE', seatCodes: ['A5'] });
      expect(single.status).toBe(200);
      expect(a5.held_by).toBe(ID.MINH);
      expect(await heldBy(ID.LAN)).toEqual([]); // all-or-nothing: none of the other nine stay held
    }
  });
});

describe('hold expiry', () => {
  async function lapse(code) {
    const past = new Date(Date.now() - 1000);
    await Booking.updateOne({ code }, { $set: { expires_at: past } });
    await Ticket.updateMany({ hold_booking_code: code }, { $set: { held_until: past } });
  }

  it('the sweep expires an unpaid group booking and releases its seats', async () => {
    const { body } = await checkout();
    await lapse(body.booking.code);

    expect(await bookingRepository.expireStalePendingBookings()).toBe(1);
    expect((await Booking.findOne({ code: body.booking.code })).status).toBe('EXPIRED');
    expect(await heldBy(ID.LAN)).toEqual([]);
  });

  it('a payment arriving after expiry is honoured when every seat is still free', async () => {
    const { body } = await checkout();
    await lapse(body.booking.code);
    await bookingRepository.expireStalePendingBookings();

    await ipn(body.booking.code);

    expect((await Booking.findOne({ code: body.booking.code })).status).toBe('PAID');
    expect(await Invoice.countDocuments({ code: body.booking.code })).toBe(10);
  });

  it("a payment arriving after one of the seats went to someone else is refunded, not half-issued", async () => {
    const { body } = await checkout();
    const { code } = body.booking;
    await lapse(code);
    await bookingRepository.expireStalePendingBookings();
    // Minh books A7 in the meantime.
    expect((await request(app).post(`/api/bookseat/${ID.SHOWTIME}/hold`).set('Authorization', auth.minh()).send({ seatCodes: ['A7'] })).status).toBe(200);

    const res = await browserConfirm(code);

    expect(res.body).toMatchObject({ success: false, refund_pending: true, reason: 'SEATS_LOST' });
    expect((await Payment.findOne({ code })).status).toBe('REFUND_PENDING');
    expect((await Booking.findOne({ code })).status).toBe('CANCELLED');
    expect(await Invoice.countDocuments()).toBe(0);
    expect(await Ticket.findOne({ id: seatId('A7') })).toMatchObject({ status: Ticket.STATUS.HELD, held_by: ID.MINH });
    expect(await Ticket.countDocuments({ status: Ticket.STATUS.BOOKED })).toBe(0);
  });

  it("a seat caught mid-sweep (HELD -> TIMEOUT -> AVAILABLE) is still the booking's when the payment lands", async () => {
    const { body } = await checkout();
    const { code } = body.booking;
    await Ticket.updateOne({ id: 3 }, { $set: { status: Ticket.STATUS.TIMEOUT } });

    await ipn(code);

    expect((await Booking.findOne({ code })).status).toBe('PAID');
    expect(await Invoice.countDocuments({ code })).toBe(10);
    expect((await Ticket.findOne({ id: 3 })).status).toBe(Ticket.STATUS.BOOKED);
  });

  it('the expiry sweep racing the payment confirmation still ends with all ten tickets issued once', async () => {
    const { body } = await checkout();
    const { code } = body.booking;
    await lapse(code);

    await Promise.all([bookingRepository.expireStalePendingBookings(), ipn(code), bookingRepository.expireAllHeldTickets(), ipn(code)]);

    expect((await Booking.findOne({ code })).status).toBe('PAID');
    expect(await Invoice.countDocuments({ code })).toBe(10);
    expect(await Ticket.countDocuments({ id: { $in: TEN }, status: Ticket.STATUS.BOOKED })).toBe(10);
  });
});

describe('cancel', () => {
  it('the customer gives up a pending group booking: every seat is released, a late payment is flagged for refund', async () => {
    const { body } = await checkout();
    const { code } = body.booking;

    const res = await request(app).post(`/api/group-bookings/${code}/cancel`).set('Authorization', auth.lan()).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(await heldBy(ID.LAN)).toEqual([]);

    await ipn(code); // they still completed the MoMo page
    expect((await Payment.findOne({ code })).status).toBe('REFUND_PENDING');
    expect(await Invoice.countDocuments()).toBe(0);
  });

  it("is refused for someone else's booking (as if it did not exist) and for a paid one", async () => {
    const { body } = await checkout();
    const other = await request(app).post(`/api/group-bookings/${body.booking.code}/cancel`).set('Authorization', auth.minh()).send({});
    expect(other.status).toBe(404);

    await ipn(body.booking.code);
    const paid = await request(app).post(`/api/group-bookings/${body.booking.code}/cancel`).set('Authorization', auth.lan()).send({});
    expect(paid.status).toBe(409);
    expect(paid.body).toMatchObject({ code: 'BOOKING_NOT_CANCELLABLE', status: 'PAID' });
  });

  it('the generic booking cancel releases a pending group booking through the same guarded path', async () => {
    const { body } = await checkout();
    await Ticket.updateOne({ id: 2 }, { $set: { held_by: ID.MINH, hold_booking_code: null } }); // A2 lapsed to Minh

    const res = await request(app).post(`/api/bookings/${body.booking.id}/cancel`).set('Authorization', auth.lan()).send({});

    expect(res.status).toBe(200);
    expect(await heldBy(ID.LAN)).toEqual([]);
    expect(await Ticket.findOne({ id: 2 })).toMatchObject({ status: Ticket.STATUS.HELD, held_by: ID.MINH });
  });
});
