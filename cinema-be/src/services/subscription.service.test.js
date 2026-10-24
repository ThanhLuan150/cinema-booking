jest.mock('../utils/socket');
jest.mock('../utils/mailer', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({}),
  sendNotificationEmail: jest.fn().mockResolvedValue({ messageId: 'x' }),
}));

const axios = require('axios');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, PLAN, DAY, seedMembershipWorld, giveSubscription } = require('../../tests/membershipFixtures');
const subscriptionService = require('./subscription.service');
const membershipService = require('./membership.service');
const systemConfigService = require('./systemConfig.service');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const ORIGINAL_ENV = process.env;
beforeAll(async () => {
  await connect();
  await Promise.all([Subscription.init(), Payment.init(), Notification.init()]);
});
beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  for (const key of ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY']) delete process.env[key];
  systemConfigService.invalidateAll();
  await seedMembershipWorld({ withRbac: false });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
});
afterAll(async () => {
  process.env = ORIGINAL_ENV;
  await closeDatabase();
});

const buy = (accountId = ID.LAN, extra = {}) => subscriptionService.purchase({ accountId, planId: PLAN.MONTHLY, ...extra });
const momo = (code, resultCode = '0', extra = {}) => ({ orderId: code, resultCode, transId: `T-${code}-${resultCode}`, ...extra });

async function expectError(promise, code, status) {
  await expect(promise).rejects.toMatchObject({ name: 'SubscriptionError', code, status });
}

describe('purchase — nothing is active before the payment is confirmed', () => {
  it('creates a PENDING_PAYMENT subscription with a pending MoMo payment and no dates', async () => {
    const { subscription, payUrl, replayed } = await buy();
    expect(replayed).toBe(false);
    expect(payUrl).toContain('/Membership/PaymentResult');
    expect(subscription).toMatchObject({
      status: 'PENDING_PAYMENT',
      start_at: null,
      end_at: null,
      price: 199000,
      plan: { code: 'MONTHLY_PASS', duration_days: 30, benefits: expect.objectContaining({ free_tickets: 4 }) },
      pay_url: payUrl,
    });
    const payment = await Payment.findOne({ code: subscription.code });
    expect(payment).toMatchObject({ type: 'SUBSCRIPTION', method: 'MOMO', status: 'PENDING', amount: 199000, booking_id: null });

    // Its benefits do not apply yet.
    expect((await membershipService.loadState(ID.LAN)).subscription).toBeNull();
  });

  it('refuses an unknown or retired plan', async () => {
    await expectError(subscriptionService.purchase({ accountId: ID.LAN, planId: 999 }), 'SUBSCRIPTION_PLAN_NOT_FOUND', 404);
    await expectError(subscriptionService.purchase({ accountId: ID.LAN, planId: PLAN.RETIRED }), 'SUBSCRIPTION_PLAN_INACTIVE', 409);
    await expectError(subscriptionService.purchase({ accountId: ID.LAN, planId: 'abc' }), 'VALIDATION_ERROR', 400);
  });

  it('keeps one open subscription per customer, even under simultaneous purchases', async () => {
    const results = await Promise.allSettled([buy(), buy(), buy(), buy()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const failed of results.filter((r) => r.status === 'rejected')) {
      expect(failed.reason).toMatchObject({ code: 'SUBSCRIPTION_ALREADY_OPEN', status: 409 });
    }
    expect(await Subscription.countDocuments({ account_id: ID.LAN, status: 'PENDING_PAYMENT' })).toBe(1);
    expect(await Payment.countDocuments({ type: 'SUBSCRIPTION' })).toBe(1);

    // Another customer is unaffected.
    expect((await buy(ID.MINH)).subscription.status).toBe('PENDING_PAYMENT');
  });

  it('answers a retry with the same Idempotency-Key with the same purchase', async () => {
    const first = await buy(ID.LAN, { idempotencyKey: 'key-1' });
    const again = await buy(ID.LAN, { idempotencyKey: 'key-1' });
    expect(again.replayed).toBe(true);
    expect(again.subscription.id).toBe(first.subscription.id);
    expect(again.payUrl).toBe(first.payUrl);
    await expectError(buy(ID.MINH, { idempotencyKey: 'key-1' }), 'IDEMPOTENCY_KEY_CONFLICT', 409);
  });

  it('withdraws the purchase when MoMo cannot be reached', async () => {
    Object.assign(process.env, { MOMO_PARTNER_CODE: 'p', MOMO_ACCESS_KEY: 'a', MOMO_SECRET_KEY: 's' });
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('ECONNREFUSED'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expectError(buy(), 'PAYMENT_GATEWAY_ERROR', 502);
    const subscription = await Subscription.findOne({ account_id: ID.LAN });
    expect(subscription.status).toBe('CANCELLED');
    expect((await Payment.findOne({ code: subscription.code })).status).toBe('FAILED');
    // ...and the slot is free again.
    delete process.env.MOMO_SECRET_KEY;
    expect((await buy()).subscription.status).toBe('PENDING_PAYMENT');
  });
});

describe('applyMomoOutcome', () => {
  it('activates on a confirmed payment: the term starts now and lasts duration_days', async () => {
    const { subscription } = await buy();
    const before = Date.now();
    const result = await subscriptionService.applyMomoOutcome(momo(subscription.code));

    expect(result).toMatchObject({ handled: true, success: true });
    const active = await Subscription.findOne({ id: subscription.id });
    expect(active.status).toBe('ACTIVE');
    expect(active.start_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(active.end_at.getTime() - active.start_at.getTime()).toBe(30 * DAY);
    expect((await Payment.findOne({ code: subscription.code })).status).toBe('PAID');
    expect(await Notification.countDocuments({ account_id: ID.LAN, type: 'SUBSCRIPTION_ACTIVATED' })).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'SUBSCRIPTION_ACTIVATED', entity_id: subscription.id })).toBe(1);

    expect((await membershipService.loadState(ID.LAN)).subscription.id).toBe(subscription.id);
  });

  it('activates once, however many times MoMo (or the browser) reports the success', async () => {
    const { subscription } = await buy();
    const results = await Promise.all([1, 2, 3].map(() => subscriptionService.applyMomoOutcome(momo(subscription.code))));
    expect(results.filter((r) => !r.alreadyProcessed)).toHaveLength(1);
    const first = await Subscription.findOne({ id: subscription.id });

    await subscriptionService.applyMomoOutcome(momo(subscription.code));
    const later = await Subscription.findOne({ id: subscription.id });
    expect(later.end_at.getTime()).toBe(first.end_at.getTime());
    expect(await Notification.countDocuments({ type: 'SUBSCRIPTION_ACTIVATED' })).toBe(1);
  });

  it('cancels on a failed payment and frees the slot', async () => {
    const { subscription } = await buy();
    const result = await subscriptionService.applyMomoOutcome(momo(subscription.code, '1006'));
    expect(result).toMatchObject({ handled: true, success: false });
    expect((await Subscription.findOne({ id: subscription.id })).status).toBe('CANCELLED');
    expect((await Payment.findOne({ code: subscription.code })).status).toBe('FAILED');

    // A success arriving after the failure changes nothing.
    await subscriptionService.applyMomoOutcome(momo(subscription.code));
    expect((await Subscription.findOne({ id: subscription.id })).status).toBe('CANCELLED');

    expect((await buy()).subscription.status).toBe('PENDING_PAYMENT');
  });

  it('never keeps money for a purchase that was withdrawn first: the payment goes to REFUND_PENDING', async () => {
    const { subscription } = await buy();
    await subscriptionService.cancelOwnPending({ code: subscription.code, accountId: ID.LAN });

    const result = await subscriptionService.applyMomoOutcome(momo(subscription.code));
    expect(result).toMatchObject({ success: true, refundPending: true });
    expect((await Subscription.findOne({ id: subscription.id })).status).toBe('CANCELLED');
    expect((await Payment.findOne({ code: subscription.code })).status).toBe('REFUND_PENDING');
  });

  it('ignores a payment that is not a subscription', async () => {
    expect(await subscriptionService.applyMomoOutcome(momo('BK-1'))).toEqual({ handled: false });
    expect(await subscriptionService.isSubscriptionPaymentCode('BK-1')).toBe(false);
  });
});

describe('expireSubscriptions', () => {
  it('ends a subscription whose term is over, and withdraws a purchase left unpaid', async () => {
    const ended = await giveSubscription(ID.LAN, { startedMinutesAgo: 31 * 24 * 60, endsInMinutes: -5 });
    const { subscription: pending } = await buy(ID.MINH);
    await Subscription.updateOne({ id: pending.id }, { $set: { payment_expires_at: new Date(Date.now() - 1000) } });

    expect(await subscriptionService.expireSubscriptions()).toEqual({ expired: 1, lapsed: 1 });
    expect((await Subscription.findOne({ id: ended.id })).status).toBe('EXPIRED');
    expect((await Subscription.findOne({ id: pending.id })).status).toBe('CANCELLED');
    expect(await Notification.countDocuments({ account_id: ID.LAN, type: 'SUBSCRIPTION_EXPIRED' })).toBe(1);
    // The lapsed purchase's payment is left PENDING, so a late success becomes a refund.
    expect((await Payment.findOne({ code: pending.code })).status).toBe('PENDING');
    expect((await subscriptionService.applyMomoOutcome(momo(pending.code))).refundPending).toBe(true);

    // Running it again does nothing more.
    expect(await subscriptionService.expireSubscriptions()).toEqual({ expired: 0, lapsed: 0 });
  });

  it("frees the customer's slot, so they can buy the next term", async () => {
    await giveSubscription(ID.LAN, { startedMinutesAgo: 31 * 24 * 60, endsInMinutes: -5 });
    expect((await buy()).subscription.status).toBe('PENDING_PAYMENT');
  });
});

describe('cancel', () => {
  it("lets a customer withdraw only their own unpaid purchase", async () => {
    const { subscription } = await buy();
    await expectError(subscriptionService.cancelOwnPending({ code: subscription.code, accountId: ID.MINH }), 'SUBSCRIPTION_NOT_FOUND', 404);
    const cancelled = await subscriptionService.cancelOwnPending({ code: subscription.code, accountId: ID.LAN });
    expect(cancelled.status).toBe('CANCELLED');
    await expectError(subscriptionService.cancelOwnPending({ code: subscription.code, accountId: ID.LAN }), 'SUBSCRIPTION_NOT_CANCELLABLE', 409);
  });

  it('does not let a customer cancel an active subscription', async () => {
    const active = await giveSubscription(ID.LAN);
    await expectError(subscriptionService.cancelOwnPending({ code: active.code, accountId: ID.LAN }), 'SUBSCRIPTION_NOT_CANCELLABLE', 409);
  });

  it('lets a Super Admin revoke an active one; its benefits stop at once', async () => {
    const active = await giveSubscription(ID.LAN);
    const cancelled = await subscriptionService.adminCancel({ id: active.id, actorId: ID.SUPER_ADMIN, reason: 'Chargeback' });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancel_reason: 'Chargeback', cancelled_by: ID.SUPER_ADMIN });
    expect((await membershipService.loadState(ID.LAN)).subscription).toBeNull();
    await expectError(subscriptionService.adminCancel({ id: active.id, actorId: ID.SUPER_ADMIN }), 'SUBSCRIPTION_NOT_CANCELLABLE', 409);
  });
});

describe('reads', () => {
  it("lists only the caller's own, and refuses someone else's by code", async () => {
    const { subscription } = await buy();
    await buy(ID.MINH);
    const mine = await subscriptionService.listMine(ID.LAN);
    expect(mine.total).toBe(1);
    expect(mine.data[0].code).toBe(subscription.code);
    await expectError(subscriptionService.getMine(subscription.code, ID.MINH), 'SUBSCRIPTION_NOT_FOUND', 404);
    expect((await subscriptionService.getMine(subscription.code, ID.LAN)).id).toBe(subscription.id);
  });

  it('keeps a sold subscription exactly as bought when its plan changes later', async () => {
    const { subscription } = await buy();
    await SubscriptionPlan.updateOne({ id: PLAN.MONTHLY }, { $set: { price: 299000, 'benefits.free_tickets': 8 } });
    const read = await subscriptionService.getMine(subscription.code, ID.LAN);
    expect(read.price).toBe(199000);
    expect(read.plan.benefits.free_tickets).toBe(4);
  });
});
