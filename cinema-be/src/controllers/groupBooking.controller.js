const groupBookingService = require('../services/groupBooking.service');
const { verifyMomoSignature } = require('../utils/momo');

const { GroupBookingError } = groupBookingService;

// Domain refusals carry context (the seat codes that were taken, the limits, the promotion's ticket
// minimum) that the generic errorHandler would drop, so they are answered here; anything else goes on
// to errorHandler (InsufficientStockError included — it already has its own shape there).
function withGroupBookingErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (!(err instanceof GroupBookingError)) throw err;
      res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
    }
  };
}

const callerOf = (req) => ({ accountId: req.account.accountId, scope: req.permissionScope });

// POST /api/group-bookings/quote { schedule_id, ticket_ids, combos, organizer, promotion_code | voucher_code }
async function quote(req, res) {
  res.json(await groupBookingService.quote({ accountId: req.account.accountId, body: req.body || {} }));
}

// POST /api/group-bookings (same body) -> 201 { booking, pay_url } | 200 the same on an idempotent replay
async function checkout(req, res) {
  const result = await groupBookingService.checkout({
    accountId: req.account.accountId,
    body: req.body || {},
    idempotencyKey: req.headers?.['idempotency-key'] || null,
    req,
  });
  res.status(result.created ? 201 : 200).json({ booking: result.booking, pay_url: result.pay_url, replayed: !result.created });
}

// GET /api/group-bookings/:code
async function getByCode(req, res) {
  res.json(await groupBookingService.getForCaller({ code: req.params.code, caller: callerOf(req) }));
}

// POST /api/group-bookings/:code/cancel { reason? }
async function cancel(req, res) {
  res.json(
    await groupBookingService.cancel({ code: req.params.code, caller: callerOf(req), reason: req.body?.reason || null, req }),
  );
}

// POST /api/group-bookings/:code/momo-confirm (the MoMo redirect's query params, as sent)
async function momoConfirm(req, res) {
  if (!verifyMomoSignature(req.body || {})) return res.status(400).json({ message: 'Invalid signature', code: 'INVALID_SIGNATURE' });
  res.json(await groupBookingService.confirmFromBrowser({ code: req.params.code, caller: callerOf(req), body: req.body }));
}

module.exports = {
  quote: withGroupBookingErrors(quote),
  checkout: withGroupBookingErrors(checkout),
  getByCode: withGroupBookingErrors(getByCode),
  cancel: withGroupBookingErrors(cancel),
  momoConfirm: withGroupBookingErrors(momoConfirm),
};
