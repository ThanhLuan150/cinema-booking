const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const ComboOrder = require('../models/ComboOrder');
const Invoice = require('../models/Invoice');
const Movie = require('../models/Movie');
const Payment = require('../models/Payment');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const comboRepository = require('../repositories/combo.repository');
const comboOrderRepository = require('../repositories/comboOrder.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const paymentRepository = require('../repositories/payment.repository');
const systemConfigService = require('./systemConfig.service');
const { recordAudit, ACTION, ENTITY_TYPE } = require('./auditLog.service');
const { verifySeatQr, signSeatQr } = require('../utils/seatQr');
const { checkOrderingWindow } = require('../utils/inSeatOrderWindow');
const { createMomoPaymentUrl, inSeatRedirectUrl } = require('../utils/momo');
const { REALTIME_ACTION } = require('../utils/realtimeEvents');

const MAX_ORDER_LINES = 20;
const MAX_LINE_QUANTITY = 20;
// MoMo refuses amounts under 1,000 VND (utils/momo.js would round the charge UP to it, so the
// customer would pay more than the order) — refused here instead.
const MIN_PAYABLE_AMOUNT = 1000;
const ALLOWED_ITEM_FIELDS = ['combo_id', 'quantity'];
const PRICE_FIELD_PATTERN = /price|total|amount|discount|cost|fee/i;
const VALID_TICKET_STATUSES = [Invoice.TICKET_STATUS.ISSUED, Invoice.TICKET_STATUS.USED];
const SOLD_BOOKING_STATUSES = [Booking.STATUS.PAID, Booking.STATUS.COMPLETED];
const IN_SEAT = ComboOrder.CHANNEL.IN_SEAT;

class InSeatOrderError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = 'InSeatOrderError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

const fail = (code, status, message, extra) => {
  throw new InSeatOrderError(code, status, message, extra);
};

// ---------------------------------------------------------------------------------------------
// Seat QR -> validated context
// ---------------------------------------------------------------------------------------------

// Resolves a scanned seat QR for `accountId` and refuses unless every link holds:
//   * the token is a genuine, untampered seat QR (SEAT_QR_INVALID);
//   * its showtime still sits in its room, and that room in its branch, and the seat is part of the
//     showtime's seat grid (SEAT_QR_STALE — e.g. the showtime was moved to another room);
//   * the caller holds a valid ticket (ISSUED, or USED = already checked in) for THAT seat at THAT
//     showtime, on a paid booking of that branch (IN_SEAT_TICKET_REQUIRED). This is what stops a QR
//     of another showtime from being used: the ticket lookup is keyed by the QR's own showtime;
//   * the showtime is still running (SHOWTIME_NOT_ACTIVE).
// Whether ordering is open right now is reported, not thrown — the page can still show the seat and
// "ordering opens at …"; createOrder is what enforces it.
async function resolveSeatContext({ qr, accountId, now = new Date() }) {
  const verified = verifySeatQr(qr);
  if (verified.error) fail('SEAT_QR_INVALID', 400, 'This is not a valid seat QR code');
  const { branchId, roomId, scheduleId, seatCode } = verified.payload;

  const [schedule, room, branch] = await Promise.all([
    Schedule.findOne({ id: scheduleId }),
    Room.findOne({ id: roomId }),
    Branch.findOne({ id: branchId }),
  ]);
  const consistent =
    schedule &&
    room &&
    branch &&
    schedule.room_id === roomId &&
    room.cinema_id === branchId &&
    (schedule.cinema_id === undefined || schedule.cinema_id === null || schedule.cinema_id === branchId);
  if (!consistent) fail('SEAT_QR_STALE', 409, 'This seat QR no longer matches a showtime');

  const ticket = await Ticket.findOne({ schedule_id: scheduleId, seat_code: seatCode });
  if (!ticket) fail('SEAT_QR_STALE', 409, 'This seat QR no longer matches a showtime');

  const noTicket = () =>
    fail('IN_SEAT_TICKET_REQUIRED', 403, 'You need a valid ticket for this seat at this showtime to order here');
  if (ticket.status !== Ticket.STATUS.BOOKED) noTicket();
  const invoice = await Invoice.findOne({
    ticket_id: ticket.id,
    account_id: Number(accountId),
    ticket_status: { $in: VALID_TICKET_STATUSES },
  }).sort({ id: -1 });
  if (!invoice || !invoice.booking_id) noTicket();
  const booking = await Booking.findOne({ id: invoice.booking_id });
  if (
    !booking ||
    booking.account_id !== Number(accountId) ||
    !SOLD_BOOKING_STATUSES.includes(booking.status) ||
    booking.branch_id !== branchId ||
    booking.schedule_id !== scheduleId
  ) {
    noTicket();
  }

  if (schedule.status !== 'ACTIVE') fail('SHOWTIME_NOT_ACTIVE', 409, 'This showtime is no longer running');

  const opensBeforeMinutes = await systemConfigService.getValue('CHECKIN_BEFORE_SHOWTIME', branchId);
  const ordering = checkOrderingWindow(schedule, now, { opensBeforeMinutes });
  const movie = await Movie.findOne({ id: schedule.movie_id }, { id: 1, name: 1, avatar: 1 });

  return { branch, room, schedule, movie, seatCode, ticket, invoice, booking, ordering };
}

function iso(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function presentOrdering(ordering) {
  return {
    open: !ordering.error,
    reason: ordering.error ?? null,
    opens_at: iso(ordering.window?.opensAt),
    closes_at: iso(ordering.window?.closesAt),
  };
}

// The seat as the customer's page shows it. Never the QR token itself, nor anything about other seats.
function presentSeatContext(context) {
  const { branch, room, schedule, movie, seatCode, invoice, booking } = context;
  return {
    branch: { id: branch.id, name: branch.name },
    room: { id: room.id, name: room.name },
    showtime: {
      id: schedule.id,
      date: schedule.movie_date,
      time_begin: schedule.time_begin,
      time_end: schedule.time_end,
    },
    movie: movie ? { id: movie.id, name: movie.name, avatar: movie.avatar || null } : null,
    seat: { code: seatCode },
    ticket: { id: invoice.id, status: invoice.ticket_status },
    booking: { id: booking.id, code: booking.code },
    ordering: presentOrdering(context.ordering),
  };
}

// What can be ordered to the seat: the branch's active combos (all types), cheapest first within type.
async function listMenu(branchId) {
  const { data } = await comboRepository.findActiveByCinemaId(branchId, { limit: 200 });
  return data
    .map((combo) => ({
      id: combo.id,
      name: combo.name,
      description: combo.description || '',
      price: combo.price,
      image: combo.image || null,
      type: combo.type,
    }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.price - b.price || a.id - b.id);
}

// ---------------------------------------------------------------------------------------------
// Presenting orders to the customer
// ---------------------------------------------------------------------------------------------

async function presentOrders(orders, { now = new Date() } = {}) {
  if (orders.length === 0) return [];
  const scheduleIds = [...new Set(orders.map((o) => o.seat_delivery?.schedule_id).filter(Boolean))];
  const roomIds = [...new Set(orders.map((o) => o.seat_delivery?.room_id).filter(Boolean))];
  const [schedules, rooms, payments] = await Promise.all([
    scheduleIds.length ? Schedule.find({ id: { $in: scheduleIds } }, { id: 1, movie_date: 1, time_begin: 1 }) : [],
    roomIds.length ? Room.find({ id: { $in: roomIds } }, { id: 1, name: 1 }) : [],
    Payment.find({ code: { $in: orders.map((o) => o.code) }, type: Payment.TYPE.IN_SEAT }),
  ]);
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const paymentByCode = new Map(payments.map((p) => [p.code, p]));

  return orders.map((order) => {
    const delivery = order.seat_delivery || null;
    const schedule = delivery ? scheduleById.get(delivery.schedule_id) : null;
    const room = delivery ? roomById.get(delivery.room_id) : null;
    const payment = paymentByCode.get(order.code) || null;
    // The MoMo link is only handed back while it can still complete this order.
    const canStillPay =
      order.status === ComboOrder.STATUS.PENDING &&
      payment?.status === Payment.STATUS.PENDING &&
      order.expires_at &&
      order.expires_at.getTime() > now.getTime();
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      items: order.items.map((item) => ({
        combo_id: item.combo_id,
        name: item.name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_total: item.line_total,
      })),
      total_price: order.total_price,
      seat: delivery
        ? {
            code: delivery.seat_code,
            room: room ? room.name : null,
            showtime: schedule
              ? { id: schedule.id, date: schedule.movie_date, time: schedule.time_begin }
              : { id: delivery.schedule_id, date: null, time: null },
          }
        : null,
      booking_id: order.booking_id,
      payment: payment
        ? { status: payment.status, method: payment.method, amount: payment.amount }
        : null,
      pay_url: canStillPay ? payment.pay_url || null : null,
      expires_at: order.expires_at,
      created_at: order.createdAt,
      paid_at: order.paid_at,
      prepared_at: order.prepared_at,
      ready_at: order.ready_at,
      delivered_at: order.delivered_at,
      cancelled_at: order.cancelled_at,
      cancel_reason: order.cancel_reason ?? null,
    };
  });
}

async function presentOrder(order, options) {
  const [shaped] = await presentOrders([order], options);
  return shaped;
}

// ---------------------------------------------------------------------------------------------
// Session (what the customer's phone shows after scanning)
// ---------------------------------------------------------------------------------------------

async function getSession({ qr, accountId, now = new Date() }) {
  const context = await resolveSeatContext({ qr, accountId, now });
  const [menu, orders] = await Promise.all([
    listMenu(context.branch.id),
    comboOrderRepository.listInSeatForAccount(accountId, { scheduleId: context.schedule.id, limit: 20 }),
  ]);
  return {
    ...presentSeatContext(context),
    menu,
    orders: await presentOrders(orders, { now }),
  };
}

// ---------------------------------------------------------------------------------------------
// Placing an order
// ---------------------------------------------------------------------------------------------

// -> [{ combo_id, quantity }] merged by combo. The client names WHAT and HOW MANY, never a price:
// a price-like key is refused outright (rather than silently ignored) so a client that tries learns
// it cannot.
function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    fail('IN_SEAT_ITEMS_REQUIRED', 400, 'Choose at least one item');
  }
  if (items.length > MAX_ORDER_LINES) {
    fail('IN_SEAT_INVALID_ITEM', 400, `An order can have at most ${MAX_ORDER_LINES} lines`);
  }
  const quantityById = new Map();
  for (const entry of items) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail('IN_SEAT_INVALID_ITEM', 400, 'Each item must be { combo_id, quantity }');
    }
    const extra = Object.keys(entry).filter((key) => !ALLOWED_ITEM_FIELDS.includes(key));
    if (extra.some((key) => PRICE_FIELD_PATTERN.test(key))) {
      fail('IN_SEAT_PRICE_READONLY', 400, 'Prices are set by the cinema, not the order', { fields: extra });
    }
    if (extra.length > 0) {
      fail('IN_SEAT_FIELD_NOT_ALLOWED', 400, `Only ${ALLOWED_ITEM_FIELDS.join(', ')} may be sent per item`, {
        fields: extra,
      });
    }
    const comboId = Number(entry.combo_id);
    const quantity = Number(entry.quantity);
    if (!Number.isInteger(comboId) || comboId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      fail('IN_SEAT_INVALID_ITEM', 400, 'Each item needs a combo_id and a whole, positive quantity');
    }
    const total = (quantityById.get(comboId) || 0) + quantity;
    if (total > MAX_LINE_QUANTITY) {
      fail('IN_SEAT_INVALID_ITEM', 400, `At most ${MAX_LINE_QUANTITY} of one item per order`);
    }
    quantityById.set(comboId, total);
  }
  return [...quantityById].map(([combo_id, quantity]) => ({ combo_id, quantity }));
}

// Prices every line from the Combo catalogue — the only place an in-seat price comes from.
async function priceItems(branchId, items) {
  const combos = await comboRepository.findByIds(items.map((item) => item.combo_id));
  const comboById = new Map(combos.map((combo) => [combo.id, combo]));
  return items.map(({ combo_id, quantity }) => {
    const combo = comboById.get(combo_id);
    if (!combo) fail('COMBO_NOT_FOUND', 400, `Combo ${combo_id} not found`);
    if (combo.cinema_id !== branchId) {
      fail('COMBO_BRANCH_MISMATCH', 400, `Combo ${combo.id} is not sold at this cinema`);
    }
    if (!combo.active) fail('COMBO_INACTIVE', 400, `Combo ${combo.id} is not available`);
    return {
      combo_id: combo.id,
      name: combo.name,
      unit_price: combo.price,
      quantity,
      line_total: combo.price * quantity,
    };
  });
}

async function replayIdempotent(idempotencyKey, accountId, now) {
  const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
  if (!existing) return null;
  if (existing.type !== Payment.TYPE.IN_SEAT || existing.account_id !== Number(accountId)) {
    fail('IDEMPOTENCY_KEY_CONFLICT', 409, 'This Idempotency-Key was already used for another request');
  }
  const order = await comboOrderRepository.findByCode(existing.code);
  if (!order) fail('IN_SEAT_ORDER_NOT_FOUND', 404, 'Order not found');
  return { order: await presentOrder(order, { now }), payUrl: existing.pay_url || null, replayed: true };
}

async function createOrder({ qr, items, accountId, idempotencyKey = null, now = new Date() }) {
  if (idempotencyKey) {
    const replay = await replayIdempotent(idempotencyKey, accountId, now);
    if (replay) return replay;
  }

  const context = await resolveSeatContext({ qr, accountId, now });
  if (context.ordering.error) {
    const closed = context.ordering.error === 'IN_SEAT_ORDERING_CLOSED';
    fail(
      context.ordering.error,
      409,
      closed ? 'In-seat ordering for this showtime has closed' : 'In-seat ordering for this showtime has not opened yet',
      presentOrdering(context.ordering),
    );
  }

  const branchId = context.branch.id;
  const orderItems = await priceItems(branchId, normalizeItems(items));
  const totalPrice = orderItems.reduce((sum, item) => sum + item.line_total, 0);
  if (totalPrice < MIN_PAYABLE_AMOUNT) {
    fail('IN_SEAT_AMOUNT_TOO_LOW', 400, `The order total must be at least ${MIN_PAYABLE_AMOUNT}`);
  }
  // Advisory, like the counter: fail fast with 409 INSUFFICIENT_STOCK before the customer pays.
  await inventoryRepository.assertAvailable(branchId, orderItems);

  // The same payment window the ticket checkout gives MoMo (System Configuration, per branch).
  const holdMinutes = await systemConfigService.getValue('BOOKING_HOLD_TIME', branchId);
  const order = await comboOrderRepository.createOrder({
    branchId,
    accountId: Number(accountId),
    bookingId: context.booking.id,
    items: orderItems,
    totalPrice,
    createdBy: Number(accountId),
    channel: IN_SEAT,
    seatDelivery: {
      schedule_id: context.schedule.id,
      room_id: context.room.id,
      seat_code: context.seatCode,
      invoice_id: context.invoice.id,
    },
    expiresAt: new Date(now.getTime() + Number(holdMinutes) * 60 * 1000),
  });

  const payment = await paymentRepository.createPayment({
    code: order.code,
    bookingId: context.booking.id,
    accountId: Number(accountId),
    branchId,
    type: Payment.TYPE.IN_SEAT,
    method: Payment.METHOD.MOMO,
    amount: totalPrice,
    idempotencyKey,
    createdBy: Number(accountId),
  });
  if (payment.code !== order.code) {
    // Lost a race with an identical request (same Idempotency-Key): that one owns the payment, so
    // this duplicate order is withdrawn and the original is returned instead.
    await comboOrderRepository.cancel(order.id, 'Duplicate request', { fromStatuses: [ComboOrder.STATUS.PENDING] });
    return replayIdempotent(idempotencyKey, accountId, now);
  }

  let payUrl;
  try {
    payUrl = await createMomoPaymentUrl(
      totalPrice,
      order.code,
      { kind: 'IN_SEAT_ORDER', comboOrderId: order.id, accountId: Number(accountId) },
      { redirectUrl: inSeatRedirectUrl(), orderInfo: `In-seat order ${order.code}` },
    );
  } catch (err) {
    console.error(`[inSeatOrder] MoMo payment for ${order.code} could not be started:`, err.message);
    await paymentRepository.markFailedIfPending(order.code, 'Payment gateway unavailable');
    await comboOrderRepository.cancel(order.id, 'Payment could not be started', {
      fromStatuses: [ComboOrder.STATUS.PENDING],
    });
    fail('PAYMENT_GATEWAY_ERROR', 502, 'The payment service is unavailable, please try again');
  }
  await paymentRepository.setPayUrl(payment.id, payUrl);

  // Not on the KDS yet (unpaid), but the branch's order list and the customer's own screen update.
  comboOrderRepository.broadcastOrder(order, REALTIME_ACTION.CREATED);
  return { order: await presentOrder(order, { now }), payUrl, replayed: false };
}

// ---------------------------------------------------------------------------------------------
// Payment outcome (MoMo IPN, webhook replay, or the browser returning from MoMo)
// ---------------------------------------------------------------------------------------------

async function isInSeatPaymentCode(code) {
  if (!code) return false;
  const payment = await paymentRepository.findByCode(String(code));
  return Boolean(payment && payment.type === Payment.TYPE.IN_SEAT);
}

async function audit(payment, action, metadata = {}) {
  await recordAudit({
    performedBy: payment.account_id ?? null,
    action,
    entityType: ENTITY_TYPE.PAYMENT,
    entityId: payment.id,
    branchId: payment.branch_id ?? null,
    metadata: { code: payment.code, channel: IN_SEAT, method: payment.method, amount: payment.amount, ...metadata },
  });
}

// Applies a (signature-verified) MoMo result to an in-seat order. Every step is guarded by the
// current status (payment PENDING/PROCESSING -> PAID once; order PENDING -> PAID once), so MoMo's own
// retries, the webhook replay and the browser confirm can all arrive, in any order, safely.
//   success -> payment PAID, order PAID (=> NEW on the Kitchen Display). Stock is taken with
//              allowShortfall: the customer has already paid, so — exactly like a combo bundled into a
//              paid booking — the sale is never refused afterwards (the shortage shows in the ledger).
//              If the order is no longer PENDING (its payment window lapsed and the sweep cancelled it),
//              the money is not kept: the payment goes to REFUND_PENDING.
//   failure -> payment FAILED, order CANCELLED (it never reached the kitchen).
async function applyMomoOutcome(body) {
  const code = String(body.orderId);
  const payment = await paymentRepository.findByCode(code);
  if (!payment || payment.type !== Payment.TYPE.IN_SEAT) return { handled: false };
  const order = await comboOrderRepository.findByCode(code);

  await paymentRepository.markProcessing(code);

  if (String(body.resultCode) !== '0') {
    const failed = await paymentRepository.markFailedIfPending(code, `MoMo resultCode ${body.resultCode}`);
    const cancelled = order
      ? await comboOrderRepository.cancel(order.id, 'Payment failed', { fromStatuses: [ComboOrder.STATUS.PENDING] })
      : null;
    if (cancelled) comboOrderRepository.broadcastOrder(cancelled, REALTIME_ACTION.STATUS_CHANGED);
    if (failed) await audit(failed, ACTION.PAYMENT_FAILED, { comboOrderId: order?.id ?? null, resultCode: body.resultCode ?? null });
    return { handled: true, success: false, order: cancelled || (order && (await comboOrderRepository.findById(order.id))) };
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
      order: order ? await comboOrderRepository.findById(order.id) : null,
    };
  }

  const paid = order ? await comboOrderRepository.markPaid(order.id, Payment.METHOD.MOMO, { allowShortfall: true }) : null;
  await audit(paidPayment || payment, ACTION.PAYMENT_SUCCESS, { comboOrderId: order?.id ?? null });
  if (paid) {
    comboOrderRepository.broadcastOrder(paid, REALTIME_ACTION.STATUS_CHANGED);
    return { handled: true, success: true, order: paid };
  }

  const latest = order ? await comboOrderRepository.findById(order.id) : null;
  const reason = `In-seat order ${code} was no longer awaiting payment (${latest ? latest.status : 'missing'})`;
  const refund = await paymentRepository.requestRefund(payment.id, reason);
  if (refund) await audit(refund, ACTION.REFUND_REQUESTED, { comboOrderId: order?.id ?? null, reason });
  return { handled: true, success: true, refundPending: true, order: latest };
}

// The hold sweep: an in-seat order whose payment never arrived within its window is cancelled, so it
// cannot be paid for (and cooked) long after the customer gave up. Its Payment is left PENDING on
// purpose — if MoMo still reports success later, applyMomoOutcome sees the order is gone and flags a
// refund instead of silently keeping the money.
async function expireStalePendingOrders(now = new Date()) {
  const stale = await comboOrderRepository.findExpiredInSeatPending(now);
  let expired = 0;
  for (const order of stale) {
    const cancelled = await comboOrderRepository.cancel(order.id, 'Payment not completed in time', {
      fromStatuses: [ComboOrder.STATUS.PENDING],
    });
    if (cancelled) {
      expired += 1;
      comboOrderRepository.broadcastOrder(cancelled, REALTIME_ACTION.STATUS_CHANGED);
    }
  }
  return expired;
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

async function listOrdersForAccount(accountId, { scheduleId = null, now = new Date() } = {}) {
  const orders = await comboOrderRepository.listInSeatForAccount(accountId, { scheduleId });
  return presentOrders(orders, { now });
}

// An in-seat order the caller may see: their own (OWN scope), or any of a branch they can access
// (BRANCH, `branchIds`), or any at all (ALL). Anything else — including an order that exists but is
// not theirs — is reported as not found, so codes cannot be probed.
async function findOrderForCaller(code, { accountId, scope, branchIds = [] }) {
  const order = await comboOrderRepository.findByCode(String(code));
  if (!order || order.channel !== IN_SEAT) return null;
  if (scope === 'ALL') return order;
  if (scope === 'BRANCH') return branchIds.includes(order.branch_id) ? order : null;
  return order.account_id === Number(accountId) ? order : null;
}

// ---------------------------------------------------------------------------------------------
// Staff: the printable seat QR sheet for one showtime
// ---------------------------------------------------------------------------------------------

async function findScheduleBranchId(scheduleId) {
  const schedule = await Schedule.findOne({ id: Number(scheduleId) }, { room_id: 1, cinema_id: 1 });
  if (!schedule) return null;
  if (schedule.cinema_id !== undefined && schedule.cinema_id !== null) return schedule.cinema_id;
  const room = await Room.findOne({ id: schedule.room_id }, { cinema_id: 1 });
  return room ? room.cinema_id : null;
}

// One signed QR per seat of the showtime's grid (its Ticket rows), in seat order.
async function buildSeatQrSheet(scheduleId) {
  const schedule = await Schedule.findOne({ id: Number(scheduleId) });
  if (!schedule) return null;
  const room = await Room.findOne({ id: schedule.room_id });
  if (!room) return null;
  const [branch, movie, tickets] = await Promise.all([
    Branch.findOne({ id: room.cinema_id }, { id: 1, name: 1 }),
    Movie.findOne({ id: schedule.movie_id }, { id: 1, name: 1 }),
    Ticket.find({ schedule_id: schedule.id }, { seat_code: 1, seat_type: 1, seat_index: 1 }).sort({ seat_index: 1 }),
  ]);
  return {
    showtime: {
      id: schedule.id,
      date: schedule.movie_date,
      time_begin: schedule.time_begin,
      time_end: schedule.time_end,
      status: schedule.status,
    },
    branch: branch ? { id: branch.id, name: branch.name } : { id: room.cinema_id, name: null },
    room: { id: room.id, name: room.name },
    movie: movie ? { id: movie.id, name: movie.name } : null,
    seats: tickets.map((ticket) => ({
      seat_code: ticket.seat_code,
      seat_type: ticket.seat_type,
      token: signSeatQr({
        branchId: room.cinema_id,
        roomId: room.id,
        scheduleId: schedule.id,
        seatCode: ticket.seat_code,
      }),
    })),
  };
}

module.exports = {
  MAX_ORDER_LINES,
  MAX_LINE_QUANTITY,
  MIN_PAYABLE_AMOUNT,
  InSeatOrderError,
  resolveSeatContext,
  presentSeatContext,
  listMenu,
  presentOrders,
  presentOrder,
  getSession,
  normalizeItems,
  createOrder,
  isInSeatPaymentCode,
  applyMomoOutcome,
  expireStalePendingOrders,
  listOrdersForAccount,
  findOrderForCaller,
  findScheduleBranchId,
  buildSeatQrSheet,
};
