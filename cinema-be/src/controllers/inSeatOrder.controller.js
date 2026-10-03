const inSeatOrderService = require('../services/inSeatOrder.service');
const comboOrderRepository = require('../repositories/comboOrder.repository');
const bookingRepository = require('../repositories/booking.repository');
const { verifyMomoSignature } = require('../utils/momo');

const { InSeatOrderError } = inSeatOrderService;
const ALLOWED_ORDER_FIELDS = ['qr', 'items'];
const PRICE_FIELD_PATTERN = /price|total|amount|discount|cost|fee/i;

// Domain refusals carry extra context (opens_at, fields, ...) that the generic errorHandler would
// drop, so they are answered here; anything else is a real fault and goes on to errorHandler.
function withInSeatErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (!(err instanceof InSeatOrderError)) throw err;
      res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
    }
  };
}

function refuse(res, status, code, message, extra = {}) {
  return res.status(status).json({ message, code, ...extra });
}

// POST /api/in-seat/session { qr } -> the seat (branch, room, showtime, movie), the caller's ticket and
// booking for it, whether ordering is open, the branch menu, and what they already ordered to it.
async function session(req, res) {
  res.json(await inSeatOrderService.getSession({ qr: req.body?.qr, accountId: req.account.accountId }));
}

// POST /api/in-seat/orders { qr, items: [{ combo_id, quantity }] } (+ optional Idempotency-Key header)
// -> 201 { order, pay_url }. The body names the seat (by its QR) and what to bring — nothing else,
// prices least of all.
async function createOrder(req, res) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const extra = Object.keys(body).filter((key) => !ALLOWED_ORDER_FIELDS.includes(key));
  if (extra.some((key) => PRICE_FIELD_PATTERN.test(key))) {
    return refuse(res, 400, 'IN_SEAT_PRICE_READONLY', 'Prices are set by the cinema, not the order', { fields: extra });
  }
  if (extra.length > 0) {
    return refuse(res, 400, 'IN_SEAT_FIELD_NOT_ALLOWED', `Only ${ALLOWED_ORDER_FIELDS.join(', ')} may be sent`, {
      fields: extra,
    });
  }

  const result = await inSeatOrderService.createOrder({
    qr: body.qr,
    items: body.items,
    accountId: req.account.accountId,
    idempotencyKey: req.headers?.['idempotency-key'] || null,
  });
  res.status(result.replayed ? 200 : 201).json({ order: result.order, pay_url: result.payUrl });
}

// POST /api/in-seat/orders/:code/momo-confirm { ...MoMo redirect query params }
// The browser landing back from MoMo (the IPN cannot reach a local dev server). Same signature check
// and the same idempotent outcome handler as the IPN; only ever for the caller's own order.
async function confirmMomo(req, res) {
  if (!verifyMomoSignature(req.body || {})) {
    return refuse(res, 400, 'PAYMENT_SIGNATURE_INVALID', 'Invalid payment signature');
  }
  if (String(req.body.orderId) !== String(req.params.code)) {
    return refuse(res, 400, 'PAYMENT_ORDER_MISMATCH', 'This payment result is for a different order');
  }
  const own = await inSeatOrderService.findOrderForCaller(req.params.code, {
    accountId: req.account.accountId,
    scope: 'OWN',
  });
  if (!own) return refuse(res, 404, 'IN_SEAT_ORDER_NOT_FOUND', 'Order not found');

  const result = await inSeatOrderService.applyMomoOutcome(req.body);
  if (!result.handled) return refuse(res, 404, 'IN_SEAT_ORDER_NOT_FOUND', 'Order not found');
  const latest = await comboOrderRepository.findByCode(own.code);
  res.json({
    success: Boolean(result.success),
    already_processed: Boolean(result.alreadyProcessed),
    refund_pending: Boolean(result.refundPending),
    order: await inSeatOrderService.presentOrder(latest),
  });
}

// GET /api/in-seat/orders?scheduleId= -> the caller's own in-seat orders, newest first.
async function listMine(req, res) {
  const scheduleId = Number(req.query.scheduleId);
  res.json(
    await inSeatOrderService.listOrdersForAccount(req.account.accountId, {
      scheduleId: Number.isInteger(scheduleId) && scheduleId > 0 ? scheduleId : null,
    }),
  );
}

// GET /api/in-seat/orders/:code -> one in-seat order (OWN: only the caller's; 404 otherwise).
async function getOrder(req, res) {
  const branchIds =
    req.permissionScope === 'BRANCH' ? await bookingRepository.resolveAccessibleBranchIds(req.account.accountId) : [];
  const order = await inSeatOrderService.findOrderForCaller(req.params.code, {
    accountId: req.account.accountId,
    scope: req.permissionScope,
    branchIds,
  });
  if (!order) return refuse(res, 404, 'IN_SEAT_ORDER_NOT_FOUND', 'Order not found');
  res.json(await inSeatOrderService.presentOrder(order));
}

// GET /api/in-seat/showtimes/:scheduleId/seat-qr -> one signed QR per seat of that showtime, to print
// or show at the seats. requireBranchAccess has already pinned the caller to the showtime's branch.
async function seatQrSheet(req, res) {
  const sheet = await inSeatOrderService.buildSeatQrSheet(req.params.scheduleId);
  if (!sheet) return refuse(res, 404, 'SHOWTIME_NOT_FOUND', 'Showtime not found');
  res.json(sheet);
}

module.exports = {
  session: withInSeatErrors(session),
  createOrder: withInSeatErrors(createOrder),
  confirmMomo: withInSeatErrors(confirmMomo),
  listMine: withInSeatErrors(listMine),
  getOrder: withInSeatErrors(getOrder),
  seatQrSheet: withInSeatErrors(seatQrSheet),
};
