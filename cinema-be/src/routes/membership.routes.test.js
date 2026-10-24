jest.mock('../utils/socket');
jest.mock('../utils/mailer', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({}),
  sendNotificationEmail: jest.fn().mockResolvedValue({ messageId: 'x' }),
}));

const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, PLAN, auth, as, seedMembershipWorld, setTier, giveSubscription } = require('../../tests/membershipFixtures');
const { errorHandler } = require('../middleware/errorHandler');
const membershipRoutes = require('./membership.routes');
const loyaltyRoutes = require('./loyalty.routes');
const systemConfigService = require('../services/systemConfig.service');
const MembershipLevel = require('../models/MembershipLevel');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const app = express();
app.use(express.json());
app.use('/api', membershipRoutes);
app.use('/api', loyaltyRoutes);
app.use(errorHandler);

const ORIGINAL_ENV = process.env;
beforeAll(async () => {
  await connect();
  await Promise.all([Subscription.init(), Payment.init(), SubscriptionPlan.init()]);
});
beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  for (const key of ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY']) delete process.env[key];
  systemConfigService.invalidateAll();
  await seedMembershipWorld();
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => {
  process.env = ORIGINAL_ENV;
  await closeDatabase();
});

const employee = () => as(3, 77);
const buy = (authorization, body = { plan_id: PLAN.MONTHLY }) =>
  request(app).post('/api/subscriptions').set('Authorization', authorization).send(body);

describe('who may do what', () => {
  it('requires a login everywhere', async () => {
    for (const path of ['/api/membership/me', '/api/subscriptions/me', '/api/subscription-plans', '/api/subscriptions']) {
      expect((await request(app).get(path)).status).toBe(401);
    }
    expect((await request(app).post('/api/subscriptions').send({ plan_id: PLAN.MONTHLY })).status).toBe(401);
  });

  it.each([
    ['a Branch Admin', () => auth.owner1()],
    ['an Employee', employee],
  ])('does not let %s buy or hold subscriptions', async (_label, who) => {
    expect((await buy(who())).status).toBe(403);
    expect((await request(app).get('/api/subscriptions/me').set('Authorization', who())).status).toBe(403);
    expect((await request(app).get('/api/subscription-plans').set('Authorization', who())).status).toBe(403);
  });

  it.each([
    ['a customer', () => auth.lan()],
    ['a Branch Admin', () => auth.owner1()],
  ])("keeps every customer's subscriptions and the plan admin from %s", async (_label, who) => {
    expect((await request(app).get('/api/subscriptions').set('Authorization', who())).status).toBe(403);
    expect((await request(app).get('/api/subscription-plans/all').set('Authorization', who())).status).toBe(403);
    expect((await request(app).post('/api/subscriptions/1/cancel').set('Authorization', who())).status).toBe(403);
    const create = await request(app)
      .post('/api/subscription-plans')
      .set('Authorization', who())
      .send({ code: 'X', name: 'X', price: 1000, duration_days: 1 });
    expect(create.status).toBe(403);
  });
});

describe('GET /api/membership/me — a customer sees only their own membership', () => {
  it('answers for the caller, whatever account id is put in the request', async () => {
    await setTier(ID.LAN, 'GOLD');
    await setTier(ID.MINH, 'VIP');
    await giveSubscription(ID.MINH);

    const res = await request(app).get(`/api/membership/me?accountId=${ID.MINH}`).set('Authorization', auth.lan());
    expect(res.status).toBe(200);
    expect(res.body.level.code).toBe('GOLD');
    expect(res.body.subscription).toBeNull();
    expect(res.body.effective_benefits).toMatchObject({ ticket_discount_percent: 10, priority_booking_hours: 12 });

    const minh = await request(app).get('/api/membership/me').set('Authorization', auth.minh());
    expect(minh.body.level.code).toBe('VIP');
    expect(minh.body.subscription).toMatchObject({ status: 'ACTIVE', tickets_remaining: 4 });
  });

  it("includes the tier's benefits in the loyalty summary too", async () => {
    await setTier(ID.LAN, 'PLATINUM');
    const res = await request(app).get('/api/loyalty/me').set('Authorization', auth.lan());
    expect(res.body.benefits).toMatchObject({ free_tickets: 1, fnb_discount_percent: 15 });
  });
});

describe('subscriptions over HTTP', () => {
  it('buys a plan: 201, pending, with a MoMo link — and refuses anything but plan_id', async () => {
    const forged = await buy(auth.lan(), { plan_id: PLAN.MONTHLY, status: 'ACTIVE', price: 1000, end_at: '2099-01-01' });
    expect(forged.status).toBe(400);
    expect(forged.body).toMatchObject({ code: 'SUBSCRIPTION_FIELD_NOT_ALLOWED', fields: ['status', 'price', 'end_at'] });
    expect(await Subscription.countDocuments()).toBe(0);

    const res = await buy(auth.lan());
    expect(res.status).toBe(201);
    expect(res.body.subscription).toMatchObject({ status: 'PENDING_PAYMENT', start_at: null, end_at: null });
    expect(res.body.pay_url).toEqual(expect.any(String));

    const again = await buy(auth.lan());
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'SUBSCRIPTION_ALREADY_OPEN', subscription: { id: res.body.subscription.id } });
  });

  it('replays an Idempotency-Key with 200', async () => {
    const first = await buy(auth.lan()).set('Idempotency-Key', 'k1');
    const second = await buy(auth.lan()).set('Idempotency-Key', 'k1');
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ replayed: true, subscription: { id: first.body.subscription.id } });
  });

  it("answers 404 for someone else's subscription, reading, cancelling or confirming it", async () => {
    const { body } = await buy(auth.lan());
    const code = body.subscription.code;
    const read = await request(app).get(`/api/subscriptions/me/${code}`).set('Authorization', auth.minh());
    const cancel = await request(app).post(`/api/subscriptions/me/${code}/cancel`).set('Authorization', auth.minh());
    const confirm = await request(app)
      .post(`/api/subscriptions/me/${code}/momo-confirm`)
      .set('Authorization', auth.minh())
      .send({ orderId: code, resultCode: '0', transId: 'T1' });
    expect([read.status, cancel.status, confirm.status]).toEqual([404, 404, 404]);
    expect((await Subscription.findOne({ code })).status).toBe('PENDING_PAYMENT');

    const mine = await request(app).get('/api/subscriptions/me').set('Authorization', auth.minh());
    expect(mine.body.total).toBe(0);
  });

  it("activates from the customer's own MoMo result, and only then", async () => {
    const { body } = await buy(auth.lan());
    const code = body.subscription.code;
    const mismatch = await request(app)
      .post(`/api/subscriptions/me/${code}/momo-confirm`)
      .set('Authorization', auth.lan())
      .send({ orderId: 'SUB-other', resultCode: '0' });
    expect(mismatch.status).toBe(400);

    const res = await request(app)
      .post(`/api/subscriptions/me/${code}/momo-confirm`)
      .set('Authorization', auth.lan())
      .send({ orderId: code, resultCode: '0', transId: 'T1' });
    expect(res.status).toBe(200);
    expect(res.body.subscription).toMatchObject({ status: 'ACTIVE', start_at: expect.any(String), end_at: expect.any(String) });

    const me = await request(app).get('/api/membership/me').set('Authorization', auth.lan());
    expect(me.body.subscription.code).toBe(code);
    expect(me.body.free_tickets.subscription).toMatchObject({ limit: 4, remaining: 4 });
  });

  it('reports a failed MoMo result as a failure and cancels the purchase', async () => {
    const { body } = await buy(auth.lan());
    const code = body.subscription.code;
    const res = await request(app)
      .post(`/api/subscriptions/me/${code}/momo-confirm`)
      .set('Authorization', auth.lan())
      .send({ orderId: code, resultCode: '1006', message: 'User cancelled' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'PAYMENT_FAILED', message: 'User cancelled' });
    expect((await Subscription.findOne({ code })).status).toBe('CANCELLED');
  });

  it('lets the Super Admin list every customer, filter by account and revoke one', async () => {
    await giveSubscription(ID.LAN);
    const minh = await giveSubscription(ID.MINH);
    const all = await request(app).get('/api/subscriptions').set('Authorization', auth.superAdmin());
    expect(all.body.total).toBe(2);
    const filtered = await request(app).get(`/api/subscriptions?accountId=${ID.MINH}`).set('Authorization', auth.superAdmin());
    expect(filtered.body.data.map((s) => s.id)).toEqual([minh.id]);
    expect((await request(app).get('/api/subscriptions?status=bogus').set('Authorization', auth.superAdmin())).status).toBe(400);

    const revoked = await request(app)
      .post(`/api/subscriptions/${minh.id}/cancel`)
      .set('Authorization', auth.superAdmin())
      .send({ reason: 'Fraud' });
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({ status: 'CANCELLED', cancel_reason: 'Fraud' });
  });
});

describe('subscription plans', () => {
  it('shows customers only the plans on sale', async () => {
    const res = await request(app).get('/api/subscription-plans').set('Authorization', auth.lan());
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.code)).toEqual(['MONTHLY_PASS']);
    expect(res.body[0].benefits).toMatchObject({ free_tickets: 4, fnb_discount_percent: 10, points_multiplier: 1 });

    const all = await request(app).get('/api/subscription-plans/all').set('Authorization', auth.superAdmin());
    expect(all.body.map((p) => p.code).sort()).toEqual(['MONTHLY_PASS', 'OLD_PASS']);
  });

  it('validates a new plan', async () => {
    const post = (body) => request(app).post('/api/subscription-plans').set('Authorization', auth.superAdmin()).send(body);
    const ok = { code: 'yearly_pass', name: 'Yearly Pass', price: 1990000, duration_days: 365, benefits: { free_tickets: 40 } };
    expect((await post({ ...ok, price: 500 })).status).toBe(400);
    expect((await post({ ...ok, duration_days: 0 })).status).toBe(400);
    expect((await post({ ...ok, code: 'bad code!' })).status).toBe(400);
    expect((await post({ ...ok, owner: 1 })).body).toMatchObject({ code: 'VALIDATION_ERROR', fields: ['owner'] });
    expect((await post({ ...ok, benefits: { fnb_discount_percent: 150 } })).body.code).toBe('INVALID_BENEFITS');
    expect((await post({ ...ok, code: 'MONTHLY_PASS' })).status).toBe(409);

    const created = await post(ok);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: 'YEARLY_PASS', active: true, benefits: { free_tickets: 40, ticket_discount_percent: 0 } });
  });

  it('updates part of a plan, and refuses a change of code', async () => {
    const put = (body) => request(app).put(`/api/subscription-plans/${PLAN.MONTHLY}`).set('Authorization', auth.superAdmin()).send(body);
    expect((await put({ code: 'NEW' })).status).toBe(400);
    const res = await put({ price: 249000, benefits: { ticket_discount_percent: 5 } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ price: 249000, benefits: { ticket_discount_percent: 5, free_tickets: 4, fnb_discount_percent: 10 } });
  });

  it('only deletes a plan nobody bought', async () => {
    await giveSubscription(ID.LAN);
    const sold = await request(app).delete(`/api/subscription-plans/${PLAN.MONTHLY}`).set('Authorization', auth.superAdmin());
    expect(sold.status).toBe(409);
    expect(sold.body.code).toBe('SUBSCRIPTION_PLAN_IN_USE');
    const unsold = await request(app).delete(`/api/subscription-plans/${PLAN.RETIRED}`).set('Authorization', auth.superAdmin());
    expect(unsold.status).toBe(200);
  });
});

describe('PUT /api/membership-levels/:id — tier benefits', () => {
  it('lets the Super Admin change part of a tier’s benefits', async () => {
    const gold = await MembershipLevel.findOne({ code: 'GOLD' });
    const res = await request(app)
      .put(`/api/membership-levels/${gold.id}`)
      .set('Authorization', auth.superAdmin())
      .send({ benefits: { free_tickets: 1, free_ticket_max_value: 90000 } });
    expect(res.status).toBe(200);
    expect(res.body.benefits).toMatchObject({ free_tickets: 1, free_ticket_max_value: 90000, ticket_discount_percent: 10 });

    const bad = await request(app)
      .put(`/api/membership-levels/${gold.id}`)
      .set('Authorization', auth.superAdmin())
      .send({ benefits: { points_multiplier: 0 } });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_BENEFITS');

    const customer = await request(app).put(`/api/membership-levels/${gold.id}`).set('Authorization', auth.lan()).send({ benefits: {} });
    expect(customer.status).toBe(403);
  });
});
