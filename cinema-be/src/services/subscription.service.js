const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const paymentRepository = require('../repositories/payment.repository');
const systemConfigService = require('./systemConfig.service');
const notificationService = require('./notification.service');
const membershipService = require('./membership.service');
const { recordAudit, ACTION, ENTITY_TYPE } = require('./auditLog.service');
const { createMomoPaymentUrl, subscriptionRedirectUrl } = require('../utils/momo');
const { emitToAccount } = require('../utils/socket');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');
const { DEFAULT_TIMEZONE, workDateFor } = require('../utils/attendanceTime');
const nextId = require('../utils/nextId');

const DAY_MS = 24 * 60 * 60 * 1000;
const { STATUS } = Subscription;

class SubscriptionError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = 'SubscriptionError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

const fail = (code, status, message, extra) => {
  throw new SubscriptionError(code, status, message, extra);
};

function announce(subscription, action) {
  if (!subscription) return;
  emitToAccount(subscription.account_id, REALTIME_EVENT.SUBSCRIPTION_UPDATED, {
    action,
    id: subscription.id,
    code: subscription.code,
    status: subscription.status,
  });
}

async function audit(action, subscription, { performedBy, req = null, reason = null, metadata = {} } = {}) {
  await recordAudit({
    req,
    performedBy: performedBy !== undefined ? performedBy : subscription.account_id,
    action,
    entityType: ENTITY_TYPE.SUBSCRIPTION,
    entityId: subscription.id,
    reason,
    metadata: { code: subscription.code, planId: subscription.plan_id, plan: subscription.plan.code, price: subscription.price, ...metadata },
  });
}

// The customer's view of their own subscription: what membershipService presents, plus the MoMo
// link while it can still complete the purchase.
async function presentForOwner(subscription, now = new Date()) {
  const view = membershipService.presentSubscription(subscription);
  if (!view) return null;
  view.pay_url = null;
  if (subscription.status === STATUS.PENDING_PAYMENT && subscription.payment_expires_at > now) {
    const payment = await paymentRepository.findByCode(subscription.code);
    if (payment && payment.status === Payment.STATUS.PENDING) view.pay_url = payment.pay_url || null;
  }
  return view;
}

// ---------------------------------------------------------------------------------------------
// Lifecycle sweeps
// ---------------------------------------------------------------------------------------------

// ACTIVE -> EXPIRED once the term is over, PENDING_PAYMENT -> CANCELLED once its payment window
// lapsed. Every benefit check already compares end_at itself, so this exists so that `status` (and
// the one-open-subscription slot, open_key) reflect reality. A lapsed purchase's Payment is left
// PENDING on purpose: if MoMo still reports success, applyMomoOutcome flags a refund.
async function expireSubscriptions({ now = new Date(), accountId = null } = {}) {
  const scope = accountId !== null && accountId !== undefined ? { account_id: Number(accountId) } : {};
  let expired = 0;
  let lapsed = 0;

  const ended = await Subscription.find({ ...scope, status: STATUS.ACTIVE, end_at: { $lte: now } });
  for (const subscription of ended) {
    const flipped = await Subscription.findOneAndUpdate(
      { id: subscription.id, status: STATUS.ACTIVE, end_at: { $lte: now } },
      { $set: { status: STATUS.EXPIRED, expired_at: now }, $unset: { open_key: 1 } },
      { new: true },
    );
    if (!flipped) continue;
    expired += 1;
    announce(flipped, 'EXPIRED');
    await notificationService.notify({
      event: notificationService.EVENT.SUBSCRIPTION_EXPIRED,
      accountId: flipped.account_id,
      data: { planName: flipped.plan.name, ref: flipped.code },
    });
  }

  const stale = await Subscription.find({ ...scope, status: STATUS.PENDING_PAYMENT, payment_expires_at: { $lte: now } });
  for (const subscription of stale) {
    const flipped = await Subscription.findOneAndUpdate(
      { id: subscription.id, status: STATUS.PENDING_PAYMENT },
      {
        $set: { status: STATUS.CANCELLED, cancelled_at: now, cancel_reason: 'Payment not completed in time' },
        $unset: { open_key: 1 },
      },
      { new: true },
    );
    if (!flipped) continue;
    lapsed += 1;
    announce(flipped, 'CANCELLED');
  }

  return { expired, lapsed };
}

// ---------------------------------------------------------------------------------------------
// Purchase
// ---------------------------------------------------------------------------------------------

async function replay(idempotencyKey, accountId, now) {
  const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
  if (!existing) return null;
  if (existing.type !== Payment.TYPE.SUBSCRIPTION || existing.account_id !== Number(accountId)) {
    fail('IDEMPOTENCY_KEY_CONFLICT', 409, 'This Idempotency-Key was already used for another request');
  }
  const subscription = await Subscription.findOne({ code: existing.code });
  if (!subscription) fail('SUBSCRIPTION_NOT_FOUND', 404, 'Subscription not found');
  return { subscription: await presentForOwner(subscription, now), payUrl: existing.pay_url || null, replayed: true };
}

// Starts buying one term of a plan: a PENDING_PAYMENT subscription + a PENDING MoMo payment. Nothing
// is active (no dates, no benefits) until applyMomoOutcome sees the payment confirmed.
async function purchase({ accountId, planId, idempotencyKey = null, req = null, now = new Date() }) {
  const id = Number(planId);
  if (!Number.isInteger(id) || id <= 0) fail('VALIDATION_ERROR', 400, 'plan_id must be a positive integer');

  if (idempotencyKey) {
    const replayed = await replay(idempotencyKey, accountId, now);
    if (replayed) return replayed;
  }

  const plan = await SubscriptionPlan.findOne({ id });
  if (!plan) fail('SUBSCRIPTION_PLAN_NOT_FOUND', 404, 'Subscription plan not found');
  if (!plan.active) fail('SUBSCRIPTION_PLAN_INACTIVE', 409, 'This subscription plan is no longer sold');

  // Frees the one-open slot of a subscription that has just ended or whose payment lapsed.
  await expireSubscriptions({ now, accountId });

  const holdMinutes = await systemConfigService.getValue('BOOKING_HOLD_TIME', null);
  const code = `SUB-${await nextId('subscriptionOrder')}`;
  let subscription;
  try {
    subscription = await Subscription.create({
      id: await nextId('subscription'),
      code,
      account_id: Number(accountId),
      plan_id: plan.id,
      plan: {
        code: plan.code,
        name: plan.name,
        price: plan.price,
        duration_days: plan.duration_days,
        benefits: plan.benefits ? plan.benefits.toObject() : {},
      },
      price: plan.price,
      status: STATUS.PENDING_PAYMENT,
      payment_expires_at: new Date(now.getTime() + Number(holdMinutes) * 60 * 1000),
      open_key: String(Number(accountId)),
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    if (idempotencyKey) {
      const replayed = await replay(idempotencyKey, accountId, now);
      if (replayed) return replayed;
    }
    const open = await Subscription.findOne({ open_key: String(Number(accountId)) });
    fail(
      'SUBSCRIPTION_ALREADY_OPEN',
      409,
      open && open.status === STATUS.ACTIVE
        ? 'You already have an active subscription'
        : 'You already have a subscription waiting for payment',
      { subscription: open ? await presentForOwner(open, now) : null },
    );
  }

  const payment = await paymentRepository.createPayment({
    code,
    bookingId: null,
    accountId: Number(accountId),
    branchId: null,
    type: Payment.TYPE.SUBSCRIPTION,
    method: Payment.METHOD.MOMO,
    amount: plan.price,
    idempotencyKey,
    createdBy: Number(accountId),
  });
  if (payment.code !== code) {
    // Lost a race with an identical request (same Idempotency-Key): that one owns the payment.
    await Subscription.updateOne(
      { id: subscription.id, status: STATUS.PENDING_PAYMENT },
      { $set: { status: STATUS.CANCELLED, cancelled_at: now, cancel_reason: 'Duplicate request' }, $unset: { open_key: 1 } },
    );
    return replay(idempotencyKey, accountId, now);
  }

  let payUrl;
  try {
    payUrl = await createMomoPaymentUrl(
      plan.price,
      code,
      { kind: 'SUBSCRIPTION', subscriptionId: subscription.id, accountId: Number(accountId) },
      { redirectUrl: subscriptionRedirectUrl(), orderInfo: `Subscription ${plan.name}` },
    );
  } catch (err) {
    console.error(`[subscription] MoMo payment for ${code} could not be started:`, err.message);
    await paymentRepository.markFailedIfPending(code, 'Payment gateway unavailable');
    await Subscription.updateOne(
      { id: subscription.id, status: STATUS.PENDING_PAYMENT },
      {
        $set: { status: STATUS.CANCELLED, cancelled_at: new Date(), cancel_reason: 'Payment could not be started' },
        $unset: { open_key: 1 },
      },
    );
    fail('PAYMENT_GATEWAY_ERROR', 502, 'The payment service is unavailable, please try again');
  }
  await paymentRepository.setPayUrl(payment.id, payUrl);
  const saved = await Subscription.findOneAndUpdate({ id: subscription.id }, { $set: { payment_id: payment.id } }, { new: true });

  await audit(ACTION.SUBSCRIPTION_PURCHASED, saved, { req });
  announce(saved, 'CREATED');
  return { subscription: await presentForOwner(saved, now), payUrl, replayed: false };
}

// ---------------------------------------------------------------------------------------------
// Payment outcome (MoMo IPN, webhook replay, or the browser returning from MoMo)
// ---------------------------------------------------------------------------------------------

async function isSubscriptionPaymentCode(code) {
  if (!code) return false;
  const payment = await paymentRepository.findByCode(String(code));
  return Boolean(payment && payment.type === Payment.TYPE.SUBSCRIPTION);
}

async function auditPayment(payment, action, metadata = {}) {
  await recordAudit({
    performedBy: payment.account_id ?? null,
    action,
    entityType: ENTITY_TYPE.PAYMENT,
    entityId: payment.id,
    metadata: { code: payment.code, channel: 'SUBSCRIPTION', method: payment.method, amount: payment.amount, ...metadata },
  });
}
async function applyMomoOutcome(body, { now = new Date() } = {}) {
  const code = String(body.orderId);
  const payment = await paymentRepository.findByCode(code);
  if (!payment || payment.type !== Payment.TYPE.SUBSCRIPTION) return { handled: false };

  await paymentRepository.markProcessing(code);

  if (String(body.resultCode) !== '0') {
    const failed = await paymentRepository.markFailedIfPending(code, `MoMo resultCode ${body.resultCode}`);
    const cancelled = await Subscription.findOneAndUpdate(
      { code, status: STATUS.PENDING_PAYMENT },
      { $set: { status: STATUS.CANCELLED, cancelled_at: now, cancel_reason: 'Payment failed' }, $unset: { open_key: 1 } },
      { new: true },
    );
    if (failed) await auditPayment(failed, ACTION.PAYMENT_FAILED, { resultCode: body.resultCode ?? null });
    announce(cancelled, 'CANCELLED');
    return { handled: true, success: false, subscription: cancelled || (await Subscription.findOne({ code })) };
  }

  const { skip, payment: paidPayment } = await paymentRepository.markPaidIfPending(code, {
    gatewayTransactionId: body.transId ? String(body.transId) : null,
    rawResponse: body,
  });
  if (skip) {
    return {
      handled: true,
      success: paidPayment?.status !== Payment.STATUS.FAILED,
      alreadyProcessed: true,
      subscription: await Subscription.findOne({ code }),
    };
  }
  await auditPayment(paidPayment || payment, ACTION.PAYMENT_SUCCESS);

  const latest = await Subscription.findOne({ code });
  const activated = latest
    ? await Subscription.findOneAndUpdate(
        { code, status: STATUS.PENDING_PAYMENT },
        {
          $set: {
            status: STATUS.ACTIVE,
            start_at: now,
            end_at: new Date(now.getTime() + latest.plan.duration_days * DAY_MS),
            paid_at: now,
            payment_id: payment.id,
          },
        },
        { new: true },
      )
    : null;

  if (activated) {
    await audit(ACTION.SUBSCRIPTION_ACTIVATED, activated, { metadata: { startAt: activated.start_at, endAt: activated.end_at } });
    announce(activated, 'ACTIVATED');
    await notificationService.notify({
      event: notificationService.EVENT.SUBSCRIPTION_ACTIVATED,
      accountId: activated.account_id,
      data: { planName: activated.plan.name, endAt: workDateFor(activated.end_at, DEFAULT_TIMEZONE), ref: activated.code },
      channels: [notificationService.CHANNEL.IN_APP, notificationService.CHANNEL.EMAIL],
    });
    return { handled: true, success: true, subscription: activated };
  }

  const current = await Subscription.findOne({ code });
  const reason = `Subscription ${code} was no longer awaiting payment (${current ? current.status : 'missing'})`;
  const refund = await paymentRepository.requestRefund(payment.id, reason);
  if (refund) await auditPayment(refund, ACTION.REFUND_REQUESTED, { reason });
  return { handled: true, success: true, refundPending: true, subscription: current };
}

// The browser's MoMo redirect (the IPN cannot reach a local dev server). Own purchase only.
async function confirmFromBrowser({ code, accountId, body }) {
  if (String(body.orderId) !== String(code)) fail('VALIDATION_ERROR', 400, 'orderId does not match this subscription');
  const subscription = await Subscription.findOne({ code: String(code) });
  if (!subscription || subscription.account_id !== Number(accountId)) {
    fail('SUBSCRIPTION_NOT_FOUND', 404, 'Subscription not found');
  }
  const result = await applyMomoOutcome(body);
  return { ...result, subscription: await presentForOwner(result.subscription || subscription) };
}

// ---------------------------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------------------------

async function findOwn(code, accountId) {
  const subscription = await Subscription.findOne({ code: String(code) });
  // Someone else's subscription answers exactly like a missing one: codes are sequential.
  if (!subscription || subscription.account_id !== Number(accountId)) {
    fail('SUBSCRIPTION_NOT_FOUND', 404, 'Subscription not found');
  }
  return subscription;
}

// The customer withdraws a purchase they have not paid for. An ACTIVE subscription cannot be
// cancelled by the customer: there is no refund rail for a term already started.
async function cancelOwnPending({ code, accountId, req = null, now = new Date() }) {
  const subscription = await findOwn(code, accountId);
  const cancelled = await Subscription.findOneAndUpdate(
    { id: subscription.id, status: STATUS.PENDING_PAYMENT },
    {
      $set: { status: STATUS.CANCELLED, cancelled_at: now, cancel_reason: 'Cancelled by customer', cancelled_by: Number(accountId) },
      $unset: { open_key: 1 },
    },
    { new: true },
  );
  if (!cancelled) {
    fail('SUBSCRIPTION_NOT_CANCELLABLE', 409, `This subscription cannot be cancelled from status ${subscription.status}`, {
      status: subscription.status,
    });
  }
  await audit(ACTION.SUBSCRIPTION_CANCELLED, cancelled, { req, reason: 'Cancelled by customer' });
  announce(cancelled, 'CANCELLED');
  return presentForOwner(cancelled, now);
}

// A Super Admin revokes a subscription (pending or active). Its benefits stop at once.
async function adminCancel({ id, actorId, reason = null, req = null, now = new Date() }) {
  const subscription = await Subscription.findOne({ id: Number(id) });
  if (!subscription) fail('SUBSCRIPTION_NOT_FOUND', 404, 'Subscription not found');
  const cancelled = await Subscription.findOneAndUpdate(
    { id: subscription.id, status: { $in: Subscription.OPEN_STATUSES } },
    {
      $set: { status: STATUS.CANCELLED, cancelled_at: now, cancel_reason: reason || 'Cancelled by administrator', cancelled_by: actorId },
      $unset: { open_key: 1 },
    },
    { new: true },
  );
  if (!cancelled) {
    fail('SUBSCRIPTION_NOT_CANCELLABLE', 409, `This subscription cannot be cancelled from status ${subscription.status}`, {
      status: subscription.status,
    });
  }
  await audit(ACTION.SUBSCRIPTION_CANCELLED, cancelled, { req, performedBy: actorId, reason: cancelled.cancel_reason });
  announce(cancelled, 'CANCELLED');
  return membershipService.presentSubscription(cancelled);
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

function statusFilter(status) {
  if (!status) return {};
  const upper = String(status).toUpperCase();
  if (!Object.values(STATUS).includes(upper)) fail('VALIDATION_ERROR', 400, `status must be one of ${Object.values(STATUS).join(', ')}`);
  return { status: upper };
}

async function listMine(accountId, { status = null, skip = 0, limit = 20 } = {}) {
  await expireSubscriptions({ accountId });
  const filter = { account_id: Number(accountId), ...statusFilter(status) };
  const [rows, total] = await Promise.all([
    Subscription.find(filter).sort({ createdAt: -1, id: -1 }).skip(skip).limit(limit),
    Subscription.countDocuments(filter),
  ]);
  const now = new Date();
  return { data: await Promise.all(rows.map((s) => presentForOwner(s, now))), total };
}

async function getMine(code, accountId) {
  await expireSubscriptions({ accountId });
  return presentForOwner(await findOwn(code, accountId));
}

async function listAll({ status = null, accountId = null, planId = null, skip = 0, limit = 20 } = {}) {
  const filter = { ...statusFilter(status) };
  if (accountId !== null && accountId !== undefined && accountId !== '') filter.account_id = Number(accountId);
  if (planId !== null && planId !== undefined && planId !== '') filter.plan_id = Number(planId);
  const [rows, total] = await Promise.all([
    Subscription.find(filter).sort({ createdAt: -1, id: -1 }).skip(skip).limit(limit),
    Subscription.countDocuments(filter),
  ]);
  return { data: rows.map((s) => membershipService.presentSubscription(s)), total };
}

module.exports = {
  SubscriptionError,
  purchase,
  applyMomoOutcome,
  isSubscriptionPaymentCode,
  confirmFromBrowser,
  cancelOwnPending,
  adminCancel,
  expireSubscriptions,
  listMine,
  getMine,
  listAll,
  presentForOwner,
};
