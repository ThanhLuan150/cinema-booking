const subscriptionService = require('../services/subscription.service');
const { verifyMomoSignature } = require('../utils/momo');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const { SubscriptionError } = subscriptionService;
// A purchase names the plan, nothing else: no price, status, dates or account — those are the server's.
const PURCHASE_FIELDS = ['plan_id'];

function withSubscriptionErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (!(err instanceof SubscriptionError)) throw err;
      res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
    }
  };
}

// POST /api/subscriptions { plan_id } (Idempotency-Key header) -> 201 { subscription, pay_url }.
// The subscription stays PENDING_PAYMENT — no dates, no benefits — until MoMo confirms the payment.
async function purchase(req, res) {
  const body = req.body || {};
  const extra = Object.keys(body).filter((key) => !PURCHASE_FIELDS.includes(key));
  if (extra.length > 0) {
    return res.status(400).json({
      message: `Only ${PURCHASE_FIELDS.join(', ')} may be sent when buying a subscription`,
      code: 'SUBSCRIPTION_FIELD_NOT_ALLOWED',
      fields: extra,
    });
  }
  const result = await subscriptionService.purchase({
    accountId: req.account.accountId,
    planId: body.plan_id,
    idempotencyKey: req.headers?.['idempotency-key'] || null,
    req,
  });
  res.status(result.replayed ? 200 : 201).json({ subscription: result.subscription, pay_url: result.payUrl, replayed: result.replayed });
}

// GET /api/subscriptions/me?status=&page=&limit= -> the caller's own subscriptions, newest first.
async function listMine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await subscriptionService.listMine(req.account.accountId, { status: req.query.status, skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/subscriptions/me/:code -> one of the caller's own (anyone else's answers 404).
async function getMine(req, res) {
  res.json(await subscriptionService.getMine(req.params.code, req.account.accountId));
}

// POST /api/subscriptions/me/:code/cancel -> withdraws an unpaid purchase.
async function cancelMine(req, res) {
  res.json(await subscriptionService.cancelOwnPending({ code: req.params.code, accountId: req.account.accountId, req }));
}

// POST /api/subscriptions/me/:code/momo-confirm { ...MoMo redirect params } -> applies the browser's
// (signature-verified) MoMo result, for when MoMo's IPN cannot reach the server (local dev).
async function momoConfirm(req, res) {
  if (!verifyMomoSignature(req.body || {})) {
    return res.status(400).json({ message: 'Invalid signature', code: 'INVALID_SIGNATURE' });
  }
  const result = await subscriptionService.confirmFromBrowser({
    code: req.params.code,
    accountId: req.account.accountId,
    body: req.body,
  });
  if (!result.success) {
    return res.status(400).json({ message: req.body.message || 'Payment failed', code: 'PAYMENT_FAILED', subscription: result.subscription });
  }
  res.json({
    subscription: result.subscription,
    alreadyProcessed: Boolean(result.alreadyProcessed),
    refundPending: Boolean(result.refundPending),
  });
}

// GET /api/subscriptions?status=&accountId=&planId=&page= -> every customer's (Super Admin).
async function listAll(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await subscriptionService.listAll({
    status: req.query.status,
    accountId: req.query.accountId,
    planId: req.query.planId,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// POST /api/subscriptions/:id/cancel { reason } -> a Super Admin revokes a pending or active one.
async function adminCancel(req, res) {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : null;
  res.json(await subscriptionService.adminCancel({ id: req.params.id, actorId: req.account.accountId, reason: reason || null, req }));
}

module.exports = {
  purchase: withSubscriptionErrors(purchase),
  listMine: withSubscriptionErrors(listMine),
  getMine: withSubscriptionErrors(getMine),
  cancelMine: withSubscriptionErrors(cancelMine),
  momoConfirm: withSubscriptionErrors(momoConfirm),
  listAll: withSubscriptionErrors(listAll),
  adminCancel: withSubscriptionErrors(adminCancel),
};
