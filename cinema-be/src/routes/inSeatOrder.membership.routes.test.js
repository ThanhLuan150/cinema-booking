// Ticket 53 on the in-seat channel: a member's F&B discount (tier or live subscription, best-of) is
// applied to food ordered to the seat — priced on the server, charged through MoMo, counted as revenue.
jest.mock('../utils/socket');
jest.mock('../utils/mailer', () =>
  Object.fromEntries(
    Object.keys(jest.requireActual('../utils/mailer')).map((name) => [name, jest.fn().mockResolvedValue({})]),
  ),
);

const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, auth, qrFor, seedInSeatWorld } = require('../../tests/inSeatFixtures');
const { errorHandler } = require('../middleware/errorHandler');
const inSeatOrderRoutes = require('./inSeatOrder.routes');
const reportingRepository = require('../repositories/reporting.repository');
const { DEFAULT_LEVELS } = require('../services/loyaltyService');
const Account = require('../models/Account');
const ComboOrder = require('../models/ComboOrder');
const MembershipLevel = require('../models/MembershipLevel');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');

const app = express();
app.use(express.json());
app.use('/api/in-seat', inSeatOrderRoutes);
app.use(errorHandler);

const ORIGINAL_ENV = process.env;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => connect());
beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env = { ...ORIGINAL_ENV };
  for (const key of ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY', 'MOMO_INSEAT_REDIRECT_URL']) {
    delete process.env[key];
  }
  await seedInSeatWorld();
  await MembershipLevel.create(DEFAULT_LEVELS.map((level, index) => ({ id: index + 1, ...level })));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
});
afterAll(async () => {
  process.env = ORIGINAL_ENV;
  await closeDatabase();
});

// 2 x Large Popcorn (65,000) + 1 Coke (30,000) = 160,000 at list price.
const ITEMS = [
  { combo_id: ID.POPCORN, quantity: 2 },
  { combo_id: ID.COKE, quantity: 1 },
];
const order = (items = ITEMS) =>
  request(app).post('/api/in-seat/orders').set('Authorization', auth.lan()).send({ qr: qrFor(), items });
const session = () => request(app).post('/api/in-seat/session').set('Authorization', auth.lan()).send({ qr: qrFor() });
const confirm = (code, resultCode = '0') =>
  request(app)
    .post(`/api/in-seat/orders/${code}/momo-confirm`)
    .set('Authorization', auth.lan())
    .send({ orderId: code, resultCode, transId: `TX-${code}-${resultCode}`, message: 'Successful.' });

const setTier = (code) => Account.updateOne({ id: ID.LAN }, { $set: { membership_level: code } });
function giveSubscription({ fnb = 20, endsIn = 30 * DAY } = {}) {
  return Subscription.create({
    id: 1,
    code: 'SUB-T1',
    account_id: ID.LAN,
    plan_id: 1,
    plan: { code: 'PASS', name: 'Pass', price: 199000, duration_days: 30, benefits: { fnb_discount_percent: fnb } },
    price: 199000,
    status: 'ACTIVE',
    start_at: new Date(Date.now() - DAY),
    end_at: new Date(Date.now() + endsIn),
  });
}

describe('in-seat orders and the member F&B discount', () => {
  it('charges a non-member the list price', async () => {
    expect((await session()).body.membership).toEqual({ level: 'NONE', fnb_discount_percent: 0 });
    const res = await order();
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ subtotal: 160000, membership_discount: 0, total_price: 160000 });
  });

  it("takes a Gold member's 10% off every item, on the server, and charges MoMo that amount", async () => {
    await setTier('GOLD');
    expect((await session()).body.membership).toEqual({ level: 'GOLD', fnb_discount_percent: 10 });

    const res = await order();
    expect(res.status).toBe(201);
    // 6,500 off each popcorn, 3,000 off the coke
    expect(res.body.order).toMatchObject({
      subtotal: 160000,
      membership_discount: 16000,
      membership_fnb_percent: 10,
      total_price: 144000,
      items: [
        expect.objectContaining({ combo_id: ID.POPCORN, unit_price: 65000, line_total: 130000 }),
        expect.objectContaining({ combo_id: ID.COKE, unit_price: 30000, line_total: 30000 }),
      ],
    });
    const { code } = res.body.order;
    expect((await Payment.findOne({ code })).amount).toBe(144000);
    expect(new URL(res.body.pay_url).searchParams.get('amount')).toBe('144000');
    expect(await ComboOrder.findOne({ code })).toMatchObject({ total_price: 144000, membership_discount: 16000 });
  });

  it('gives the better of the tier and a live subscription, never both', async () => {
    await setTier('GOLD'); // 10%
    await giveSubscription({ fnb: 20 });
    const res = await order();
    expect(res.body.order).toMatchObject({ membership_discount: 32000, membership_fnb_percent: 20, total_price: 128000 });
  });

  it('gives nothing from a subscription past its term, or from a tier that is switched off', async () => {
    await giveSubscription({ fnb: 20, endsIn: -60 * 1000 }); // still ACTIVE, but ended
    expect((await order()).body.order.membership_discount).toBe(0);

    await setTier('GOLD');
    await MembershipLevel.updateOne({ code: 'GOLD' }, { $set: { active: false } });
    expect((await order([{ combo_id: ID.COKE, quantity: 1 }])).body.order.total_price).toBe(30000);
  });

  it('never takes a discount from the client', async () => {
    await setTier('GOLD');
    const res = await order([{ combo_id: ID.POPCORN, quantity: 1, discount: 65000 }]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IN_SEAT_PRICE_READONLY');
  });

  it('counts the discounted amount as revenue once paid, and shows the breakdown on the order', async () => {
    await setTier('GOLD');
    const { body } = await order();
    expect((await confirm(body.order.code)).status).toBe(200);

    const breakdown = await reportingRepository.getRevenueBreakdown({ branchIds: [ID.BRANCH_1] });
    expect(breakdown.comboRevenue).toBe(144000);

    const read = await request(app).get(`/api/in-seat/orders/${body.order.code}`).set('Authorization', auth.lan());
    expect(read.body).toMatchObject({ subtotal: 160000, membership_discount: 16000, total_price: 144000, payment: { amount: 144000 } });
  });
});
