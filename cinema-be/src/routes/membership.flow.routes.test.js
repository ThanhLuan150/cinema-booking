jest.mock('../utils/mailer', () =>
  Object.fromEntries(
    Object.keys(jest.requireActual('../utils/mailer')).map((name) => [name, jest.fn().mockResolvedValue({})]),
  ),
);

const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, PRICE, DAY, auth, seatIds, seedMembershipWorld, setTier, giveSubscription } = require('../../tests/membershipFixtures');
const { promotion } = require('../../tests/groupBookingFixtures');
const { errorHandler } = require('../middleware/errorHandler');
const bookingRoutes = require('./booking.routes');
const membershipRoutes = require('./membership.routes');
const scheduleRoutes = require('./schedule.routes');
const groupBookingRoutes = require('./groupBooking.routes');
const kioskRoutes = require('./kiosk.routes');
const { generateKioskKey, hashKioskKey } = require('../utils/kioskKey');
const Account = require('../models/Account');
const Kiosk = require('../models/Kiosk');
const bookingRepository = require('../repositories/booking.repository');
const systemConfigService = require('../services/systemConfig.service');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const MembershipBenefitUsage = require('../models/MembershipBenefitUsage');
const Payment = require('../models/Payment');
const PointsTransaction = require('../models/PointsTransaction');
const Promotion = require('../models/Promotion');
const Schedule = require('../models/Schedule');
const Subscription = require('../models/Subscription');
const Ticket = require('../models/Ticket');
const TierBenefitCounter = require('../models/TierBenefitCounter');
const { POPCORN, DRINK } = ID;

const app = express();
app.use(express.json());
app.use('/api/schedule', scheduleRoutes);
app.use('/api/group-bookings', groupBookingRoutes);
app.use('/api/kiosks', kioskRoutes);
app.use('/api', membershipRoutes);
app.use('/api', bookingRoutes);
app.use(errorHandler);

const ORIGINAL_ENV = process.env;
beforeAll(async () => {
  await connect();
  await Promise.all([
    Booking.init(),
    Invoice.init(),
    Payment.init(),
    PointsTransaction.init(),
    Subscription.init(),
    MembershipBenefitUsage.init(),
    TierBenefitCounter.init(),
  ]);
});
beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env = { ...ORIGINAL_ENV };
  for (const key of ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY']) delete process.env[key];
  systemConfigService.invalidateAll();
  await seedMembershipWorld();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
  systemConfigService.invalidateAll();
});
afterAll(async () => {
  process.env = ORIGINAL_ENV;
  await closeDatabase();
});

// --- helpers ------------------------------------------------------------------------------------

const hold = (who, ...seats) => request(app).post(`/api/bookseat/${ID.SHOWTIME}/hold`).set('Authorization', who()).send({ seatCodes: seats });

function checkout(who, body, idempotencyKey = null) {
  const req = request(app).post('/api/MomoPayment').set('Authorization', who());
  if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey);
  return req.send(body);
}

// The mock MoMo link carries exactly what MoMo would post back.
function momoResult(payUrl, resultCode = '0') {
  const params = Object.fromEntries(new URL(payUrl).searchParams);
  return { orderId: params.orderId, extraData: params.extraData, amount: params.amount, resultCode, transId: `T-${params.orderId}-${resultCode}` };
}
const ipn = (payUrl, resultCode = '0') => request(app).post('/api/MomoPayment/ipn').send(momoResult(payUrl, resultCode));
const orderIdOf = (payUrl) => new URL(payUrl).searchParams.get('orderId');
const usagesOf = (code) => MembershipBenefitUsage.find({ booking_code: code }).sort({ ticket_id: 1 });

// --- tier benefits ---------------------------------------------------------------------------------

describe('tier discounts are applied by the server', () => {
  it("takes a Gold member's ticket and F&B discount off, whatever total the client sends", async () => {
    await setTier(ID.LAN, 'GOLD'); // 10% tickets, 10% F&B, x1.25 points
    await hold(auth.lan, 'A1');
    const res = await checkout(auth.lan, {
      ticketIds: seatIds('A1'),
      comboIds: [POPCORN],
      totalPrice: 1000,
      discountAmount: 999999,
    });
    expect(res.status).toBe(200);
    const code = orderIdOf(res.text);

    const booking = await Booking.findOne({ code });
    expect(booking).toMatchObject({
      seat_total: PRICE.REGULAR,
      combo_total: 50000,
      membership_discount: 15000,
      discount_amount: 15000,
      total_price: 135000,
      membership: { level: 'GOLD', ticket_discount_percent: 10, ticket_discount_amount: 10000, fnb_discount_percent: 10, fnb_discount_amount: 5000 },
    });
    expect((await Payment.findOne({ code })).amount).toBe(135000);

    expect((await ipn(res.text)).status).toBe(200);
    expect((await Booking.findOne({ code })).status).toBe('PAID');
    // floor(135000 / 10000 * 1.25)
    expect((await PointsTransaction.findOne({ booking_id: booking.id, type: 'EARN' })).points).toBe(16);
  });

  it('gives a non-member the list price', async () => {
    await hold(auth.lan, 'A1');
    const res = await checkout(auth.lan, { ticketIds: seatIds('A1'), comboIds: [POPCORN] });
    const booking = await Booking.findOne({ code: orderIdOf(res.text) });
    expect(booking).toMatchObject({ total_price: 150000, discount_amount: 0, membership_discount: 0, membership: null });
  });

  it('works out a promotion on what the member still pays', async () => {
    await setTier(ID.LAN, 'GOLD');
    await Promotion.create(promotion({ id: 50, code: 'TENOFF', discount_value: 10 }));
    await hold(auth.lan, 'A1');
    const res = await checkout(auth.lan, { ticketIds: seatIds('A1'), promotionCode: 'TENOFF' });
    // 100,000 - 10% member = 90,000; - 10% promotion = 81,000
    const booking = await Booking.findOne({ code: orderIdOf(res.text) });
    expect(booking).toMatchObject({ total_price: 81000, discount_amount: 19000, membership_discount: 10000, promotion_code: 'TENOFF' });
  });
});

// --- free tickets ----------------------------------------------------------------------------------

describe('subscription free tickets at checkout', () => {
  it('reserves the free ticket at checkout and marks it used once paid', async () => {
    const subscription = await giveSubscription(ID.LAN); // 4 tickets, 10% F&B
    await hold(auth.lan, 'A1', 'B1');
    const res = await checkout(auth.lan, { ticketIds: seatIds('A1', 'B1'), comboIds: [DRINK], freeTickets: 1 });
    expect(res.status).toBe(200);
    const code = orderIdOf(res.text);

    // The dearer seat (B1, 120,000) is the one covered; the drink is 10% off.
    const booking = await Booking.findOne({ code });
    expect(booking).toMatchObject({
      total_price: PRICE.REGULAR + 27000,
      membership: { subscription_id: subscription.id, free_tickets: 1, free_ticket_amount: PRICE.VIP, fnb_discount_amount: 3000 },
    });
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(1);
    expect((await usagesOf(code)).map((u) => [u.ticket_id, u.status])).toEqual([[seatIds('B1')[0], 'RESERVED']]);

    await ipn(res.text);
    expect((await usagesOf(code))[0]).toMatchObject({ status: 'CONSUMED', booking_id: booking.id });
    expect(await Invoice.countDocuments({ code })).toBe(2);
  });

  it('settles an order the pass covers in full on the spot — no MoMo, tickets issued', async () => {
    const subscription = await giveSubscription(ID.LAN);
    await hold(auth.lan, 'A1');
    const res = await checkout(auth.lan, { ticketIds: seatIds('A1'), freeTickets: 1 }, 'covered-1');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ covered: true, code: expect.stringMatching(/^BK-/) });

    const { code } = res.body;
    expect(await Payment.findOne({ code })).toMatchObject({ method: 'MEMBERSHIP', amount: 0, status: 'PAID', type: 'ONLINE' });
    expect(await Booking.findOne({ code })).toMatchObject({ status: 'PAID', total_price: 0, discount_amount: PRICE.REGULAR });
    expect(await Invoice.findOne({ code })).toMatchObject({ ticket_status: 'ISSUED' });
    expect((await Ticket.findOne({ id: seatIds('A1')[0] })).status).toBe(Ticket.STATUS.BOOKED);
    expect((await usagesOf(code))[0].status).toBe('CONSUMED');

    // A retry of the same request gets the same answer and uses nothing more.
    const retry = await checkout(auth.lan, { ticketIds: seatIds('A1'), freeTickets: 1 }, 'covered-1');
    expect(retry.status).toBe(201);
    expect(retry.body.code).toBe(code);
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(1);
    expect(await Booking.countDocuments()).toBe(1);
  });

  it('never goes past the usage limit when two checkouts race for the last free ticket', async () => {
    const subscription = await giveSubscription(ID.LAN, { ticketsUsed: 3 });
    await hold(auth.lan, 'A1', 'A2');
    const [first, second] = await Promise.all([
      checkout(auth.lan, { ticketIds: seatIds('A1'), freeTickets: 1 }),
      checkout(auth.lan, { ticketIds: seatIds('A2'), freeTickets: 1 }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.code).toBe('MEMBERSHIP_FREE_TICKETS_UNAVAILABLE');
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(4);
    expect(await MembershipBenefitUsage.countDocuments({ status: { $ne: 'RELEASED' } })).toBe(1);
  });

  it('refuses free tickets from an expired subscription, and charges full price without them', async () => {
    await giveSubscription(ID.LAN, { startedMinutesAgo: 40 * 24 * 60, endsInMinutes: -60 }); // ended, sweep not run
    await hold(auth.lan, 'A1');
    const refused = await checkout(auth.lan, { ticketIds: seatIds('A1'), comboIds: [DRINK], freeTickets: 1 });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: 'MEMBERSHIP_FREE_TICKETS_UNAVAILABLE', requested: 1, available: 0 });

    const res = await checkout(auth.lan, { ticketIds: seatIds('A1'), comboIds: [DRINK] });
    expect((await Booking.findOne({ code: orderIdOf(res.text) })).total_price).toBe(PRICE.REGULAR + 30000); // no F&B discount either
  });

  it('refuses more free tickets than the order has seats', async () => {
    await giveSubscription(ID.LAN);
    await hold(auth.lan, 'A1');
    for (const freeTickets of [-1, 1.5, 2, 'two']) {
      const res = await checkout(auth.lan, { ticketIds: seatIds('A1'), freeTickets });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_FREE_TICKETS');
    }
  });

  it("uses a VIP's monthly tier tickets once the pass is spent", async () => {
    await setTier(ID.LAN, 'VIP'); // 2 free a month, 15% tickets
    await giveSubscription(ID.LAN, { ticketsUsed: 4 });
    await hold(auth.lan, 'A1', 'A2', 'A3');
    const res = await checkout(auth.lan, { ticketIds: seatIds('A1', 'A2', 'A3'), freeTickets: 2 });
    const booking = await Booking.findOne({ code: orderIdOf(res.text) });
    expect(booking.membership).toMatchObject({ free_tickets: 2, ticket_discount_amount: 15000 });
    expect(booking.total_price).toBe(85000);
    expect((await TierBenefitCounter.findOne({ account_id: ID.LAN })).used).toBe(2);
  });
});

describe('free tickets come back when the booking does not go ahead', () => {
  async function reservedCheckout() {
    const subscription = await giveSubscription(ID.LAN);
    await hold(auth.lan, 'A1', 'A2');
    const res = await checkout(auth.lan, { ticketIds: seatIds('A1', 'A2'), freeTickets: 1 });
    return { subscription, payUrl: res.text, code: orderIdOf(res.text) };
  }
  const ticketsUsed = async (subscription) => (await Subscription.findOne({ id: subscription.id })).tickets_used;

  it('when the payment fails', async () => {
    const { subscription, payUrl, code } = await reservedCheckout();
    await ipn(payUrl, '1006');
    expect((await Booking.findOne({ code })).status).toBe('CANCELLED');
    expect(await ticketsUsed(subscription)).toBe(0);
    expect((await usagesOf(code))[0]).toMatchObject({ status: 'RELEASED', release_reason: 'PAYMENT_FAILED' });
  });

  it('when the payment window lapses', async () => {
    const { subscription, code } = await reservedCheckout();
    await Booking.updateOne({ code }, { $set: { expires_at: new Date(Date.now() - 1000) } });
    await bookingRepository.expireStalePendingBookings();
    expect(await ticketsUsed(subscription)).toBe(0);
    expect((await usagesOf(code))[0].release_reason).toBe('BOOKING_EXPIRED');
  });

  it('when the customer cancels the paid booking', async () => {
    const { subscription, payUrl, code } = await reservedCheckout();
    await ipn(payUrl);
    const booking = await Booking.findOne({ code });
    const res = await request(app).post(`/api/bookings/${booking.id}/cancel`).set('Authorization', auth.lan()).send({});
    expect(res.status).toBe(200);
    expect(await ticketsUsed(subscription)).toBe(0);
  });

  it('when only the covered ticket is cancelled', async () => {
    const { subscription, payUrl, code } = await reservedCheckout();
    await ipn(payUrl);
    const [covered] = await usagesOf(code);
    const invoice = await Invoice.findOne({ code, ticket_id: covered.ticket_id });
    const other = await Invoice.findOne({ code, ticket_id: { $ne: covered.ticket_id } });

    await request(app).post(`/api/invoice/${other.id}/cancel`).set('Authorization', auth.lan());
    expect(await ticketsUsed(subscription)).toBe(1);
    await request(app).post(`/api/invoice/${invoice.id}/cancel`).set('Authorization', auth.lan());
    expect(await ticketsUsed(subscription)).toBe(0);
  });

  it('when the booking is refunded', async () => {
    const { subscription, payUrl, code } = await reservedCheckout();
    await ipn(payUrl);
    await bookingRepository.applyRefund(await Booking.findOne({ code }));
    expect(await ticketsUsed(subscription)).toBe(0);
  });

  it("refunds a late payment whose free ticket was spent elsewhere meanwhile, instead of issuing tickets", async () => {
    const subscription = await giveSubscription(ID.LAN, { ticketsUsed: 3 });
    await hold(auth.lan, 'A1', 'A2');
    const late = await checkout(auth.lan, { ticketIds: seatIds('A1'), freeTickets: 1, comboIds: [DRINK] });
    const code = orderIdOf(late.text);
    await Booking.updateOne({ code }, { $set: { expires_at: new Date(Date.now() - 1000) } });
    await bookingRepository.expireStalePendingBookings();
    // The returned ticket is spent on another booking...
    expect((await checkout(auth.lan, { ticketIds: seatIds('A2'), freeTickets: 1 })).status).toBe(201);
    // ...and then MoMo reports the first one paid.
    expect((await ipn(late.text)).status).toBe(200);

    expect((await Payment.findOne({ code })).status).toBe('REFUND_PENDING');
    expect((await Booking.findOne({ code })).status).toBe('CANCELLED');
    expect(await Invoice.countDocuments({ code })).toBe(0);
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(4);
  });
});

// --- preview -----------------------------------------------------------------------------------------

describe('POST /api/membership/me/preview', () => {
  it('quotes exactly what the checkout then charges, and reserves nothing', async () => {
    await setTier(ID.LAN, 'GOLD');
    const subscription = await giveSubscription(ID.LAN);
    const body = { ticketIds: seatIds('A1', 'B1'), comboIds: [POPCORN, DRINK], freeTickets: 1 };
    const preview = await request(app).post('/api/membership/me/preview').set('Authorization', auth.lan()).send(body);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({
      seat_total: PRICE.REGULAR + PRICE.VIP,
      combo_total: 80000,
      membership: {
        level: 'GOLD',
        free_tickets: { requested: 1, applied: 1, available: 2 },
        covered_ticket_ids: seatIds('B1'),
        free_ticket_amount: PRICE.VIP,
        ticket_discount_amount: 10000,
        fnb_discount_amount: 8000,
      },
      sale: { open: true },
    });
    expect((await Subscription.findOne({ id: subscription.id })).tickets_used).toBe(0);

    await hold(auth.lan, 'A1', 'B1');
    const res = await checkout(auth.lan, body);
    expect((await Booking.findOne({ code: orderIdOf(res.text) })).total_price).toBe(preview.body.total_price);
  });
});

// --- priority booking ----------------------------------------------------------------------------------

describe('Priority Booking — members book before general sale', () => {
  const openSaleIn = (hours) => Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { sale_opens_at: new Date(Date.now() + hours * 60 * 60 * 1000) } });

  it('keeps the public out until sale opens, and lets members in their priority hours early', async () => {
    await openSaleIn(6);
    const blocked = await hold(auth.lan, 'A1');
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'SALE_NOT_OPEN', opens_at: expect.any(String) });
    expect((await checkout(auth.lan, { ticketIds: seatIds('A1') })).status).toBe(403);

    await setTier(ID.MINH, 'GOLD'); // 12 hours early
    expect((await hold(auth.minh, 'A1')).status).toBe(200);
    expect((await checkout(auth.minh, { ticketIds: seatIds('A1') })).status).toBe(200);

    const access = await request(app).get(`/api/membership/me/sale-access/${ID.SHOWTIME}`).set('Authorization', auth.lan());
    expect(access.body).toMatchObject({ open: false, priority_booking_hours: 0 });
  });

  it('opens to everyone once general sale starts', async () => {
    await openSaleIn(-1);
    expect((await hold(auth.lan, 'A1')).status).toBe(200);
  });

  it('keeps a kiosk (it sells as a guest, with no membership) out until general sale', async () => {
    await openSaleIn(6);
    const key = generateKioskKey();
    await Account.create({ id: 900, email: 'kiosk-1@kiosk.local', password: 'x', name: 'K1', role: 1 });
    await Kiosk.create({
      id: 1,
      kiosk_code: 'KSK-1',
      name: 'Lobby kiosk',
      branch_id: ID.BRANCH_1,
      guest_account_id: 900,
      api_key_hash: hashKioskKey(key),
      status: 'ACTIVE',
    });
    const kioskHold = () => request(app).post(`/api/kiosks/showtimes/${ID.SHOWTIME}/hold`).set('X-Kiosk-Key', key).send({ seatCodes: ['A1'] });

    const blocked = await kioskHold();
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('SALE_NOT_OPEN');
    await openSaleIn(-1);
    expect((await kioskHold()).status).toBe(200);
  });

  it('applies to group bookings too, by the organiser’s own membership', async () => {
    await openSaleIn(6);
    const body = { schedule_id: ID.SHOWTIME, ticket_ids: seatIds('A1', 'A2'), combos: [], organizer: { organizer_type: 'CUSTOMER' } };
    const quote = (who) => request(app).post('/api/group-bookings/quote').set('Authorization', who()).send(body);
    const blocked = await quote(auth.lan);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('SALE_NOT_OPEN');

    await setTier(ID.LAN, 'GOLD');
    expect((await quote(auth.lan)).status).toBe(200);
  });

  it('lets an admin set and clear a showtime’s sale opening, only with an explicit offset and before the show', async () => {
    const put = (sale_opens_at) =>
      request(app).put(`/api/schedule/${ID.SHOWTIME}`).set('Authorization', auth.superAdmin()).send({ sale_opens_at });
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);

    expect((await put(soon.toISOString())).status).toBe(200);
    expect((await Schedule.findOne({ id: ID.SHOWTIME })).sale_opens_at).toEqual(soon);
    expect((await put('2026-11-01T10:00:00')).body.code).toBe('INVALID_SALE_OPENS_AT');
    expect((await put(new Date(Date.now() + 3 * DAY).toISOString())).body.code).toBe('INVALID_SALE_OPENS_AT');
    expect((await put(null)).status).toBe(200);
    expect((await Schedule.findOne({ id: ID.SHOWTIME })).sale_opens_at).toBeNull();
  });
});
