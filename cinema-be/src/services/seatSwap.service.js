const Booking = require('../models/Booking');
const ComboOrder = require('../models/ComboOrder');
const Invoice = require('../models/Invoice');
const Schedule = require('../models/Schedule');
const Seat = require('../models/Seat');
const Ticket = require('../models/Ticket');
const bookingRepository = require('../repositories/booking.repository');
const refundRepository = require('../repositories/refund.repository');
const systemConfigService = require('./systemConfig.service');
const { recordAudit, ACTION, ENTITY_TYPE } = require('./auditLog.service');
const { generateQrToken } = require('../utils/qrToken');

const PRICE_POLICY = { SAME_PRICE_ONLY: 'SAME_PRICE_ONLY', ALLOW_CHEAPER: 'ALLOW_CHEAPER' };
const { NONE, NOT_REFUNDED } = Invoice.SEAT_SWAP_SETTLEMENT;
// Food ordered to the old seat that has not reached it yet — swapping now would send it to a stranger.
const OPEN_IN_SEAT_STATUSES = [
  ComboOrder.STATUS.PENDING,
  ComboOrder.STATUS.PAID,
  ComboOrder.STATUS.PREPARING,
  ComboOrder.STATUS.READY,
];
const ALLOWED_FIELDS = ['seat_code', 'seat_id', 'schedule_id'];
const PRICE_FIELD_PATTERN = /price|total|amount|discount|cost|fee|difference|settlement/i;

class SeatSwapError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = 'SeatSwapError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

const fail = (code, status, message, extra) => {
  throw new SeatSwapError(code, status, message, extra);
};

function showtimeStartMs(schedule) {
  // movie_date + time_begin are LOCAL time everywhere in this codebase.
  return new Date(`${schedule.movie_date}T${schedule.time_begin}:00`).getTime();
}

// OWN: the ticket AND its booking are the caller's. BRANCH: the booking is at one of the caller's
// branches. ALL: anything.
async function callerMayAct({ accountId, scope }, invoice, booking) {
  if (scope === 'ALL') return true;
  if (scope === 'OWN') {
    return invoice.account_id === Number(accountId) && (!booking || booking.account_id === Number(accountId));
  }
  if (scope === 'BRANCH') {
    if (!booking) return false;
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(accountId);
    return branchIds.includes(booking.branch_id);
  }
  return false;
}

// 404 / 403 only — whether the caller may touch this ticket at all. Whether its seat may change is
// assertSwappable's job.
async function loadTicket({ invoiceId, caller }) {
  const id = Number(invoiceId);
  if (!Number.isInteger(id) || id <= 0) fail('TICKET_NOT_FOUND', 404, 'Ticket not found');
  const invoice = await Invoice.findOne({ id });
  if (!invoice) fail('TICKET_NOT_FOUND', 404, 'Ticket not found');
  const booking = invoice.booking_id ? await Booking.findOne({ id: invoice.booking_id }) : null;
  if (!(await callerMayAct(caller, invoice, booking))) {
    fail('TICKET_NOT_OWNED', 403, 'You can only change the seat of your own ticket');
  }
  const fromTicket = await Ticket.findOne({ id: invoice.ticket_id });
  const schedule = fromTicket ? await Schedule.findOne({ id: fromTicket.schedule_id }) : null;
  return { invoice, booking, fromTicket, schedule };
}

async function loadPolicy(branchId) {
  const [afterPayment, pricePolicy] = await Promise.all([
    systemConfigService.getValue('SEAT_SWAP_AFTER_PAYMENT', branchId),
    systemConfigService.getValue('SEAT_SWAP_PRICE_POLICY', branchId),
  ]);
  return { after_payment: afterPayment !== false, price_policy: pricePolicy };
}

// Every rule about the ticket itself (not the seat it is moving to). Returns the branch's policy.
async function assertSwappable(ctx, { now = new Date() } = {}) {
  const { invoice, booking, fromTicket, schedule } = ctx;

  if (invoice.status !== 1 || invoice.ticket_status !== Invoice.TICKET_STATUS.ISSUED) {
    fail(
      'SEAT_SWAP_TICKET_INVALID',
      400,
      `This ticket is ${String(invoice.ticket_status).toLowerCase()} and its seat can no longer be changed`,
      { ticket_status: invoice.ticket_status },
    );
  }
  if (!booking || booking.status !== Booking.STATUS.PAID || !fromTicket || !booking.ticket_ids.includes(fromTicket.id)) {
    fail('SEAT_SWAP_TICKET_INVALID', 400, 'This ticket does not belong to a paid booking', {
      ticket_status: invoice.ticket_status,
    });
  }
  if (!schedule) fail('SHOWTIME_INVALID', 400, 'This showtime is no longer valid');
  if (schedule.status !== 'ACTIVE') fail('SCHEDULE_CANCELLED', 400, 'This showtime has been cancelled');
  if (now.getTime() >= showtimeStartMs(schedule)) {
    fail('SEAT_SWAP_SHOWTIME_STARTED', 400, 'This showtime has already started, so the seat can no longer be changed');
  }

  const policy = await loadPolicy(booking.branch_id ?? null);
  if (!policy.after_payment) {
    fail(
      'SEAT_SWAP_NOT_ALLOWED_AFTER_PAYMENT',
      400,
      "This cinema's policy does not allow changing seats after payment",
      { policy },
    );
  }

  if (await refundRepository.findActiveByBookingId(booking.id)) {
    fail('SEAT_SWAP_REFUND_IN_PROGRESS', 400, 'A refund is in progress for this booking, so its seats cannot change');
  }
  const openInSeatOrder = await ComboOrder.exists({
    channel: ComboOrder.CHANNEL.IN_SEAT,
    'seat_delivery.invoice_id': invoice.id,
    status: { $in: OPEN_IN_SEAT_STATUSES },
  });
  if (openInSeatOrder) {
    fail(
      'SEAT_SWAP_IN_SEAT_ORDER_OPEN',
      409,
      'Food ordered to this seat has not been delivered yet — change the seat once it is delivered or cancelled',
    );
  }
  return policy;
}

// The body names the new seat and nothing else. A price-like key is refused outright (not ignored)
// so a client that tries to set the price learns it cannot.
function readRequest(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const extra = Object.keys(input).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (extra.some((key) => PRICE_FIELD_PATTERN.test(key))) {
    fail('SEAT_SWAP_PRICE_READONLY', 400, 'The price difference is calculated by the cinema, not sent by the client', {
      fields: extra,
    });
  }
  if (extra.length > 0) {
    fail('SEAT_SWAP_FIELD_NOT_ALLOWED', 400, `Only ${ALLOWED_FIELDS.join(', ')} may be sent`, { fields: extra });
  }
  const seatCode = input.seat_code === undefined || input.seat_code === null ? '' : String(input.seat_code).trim().toUpperCase();
  const hasSeatId = input.seat_id !== undefined && input.seat_id !== null && input.seat_id !== '';
  const hasScheduleId = input.schedule_id !== undefined && input.schedule_id !== null && input.schedule_id !== '';
  if (!seatCode && !hasSeatId) fail('SEAT_SWAP_SEAT_REQUIRED', 400, 'Choose the new seat (seat_code)');
  return {
    seatCode,
    seatId: hasSeatId ? Number(input.seat_id) : null,
    scheduleId: hasScheduleId ? Number(input.schedule_id) : null,
  };
}

// The new seat: same showtime, a real seat of the grid, in service, and AVAILABLE right now.
async function resolveTarget(ctx, request) {
  const { schedule, fromTicket } = ctx;
  const mismatch = () => fail('SEAT_SWAP_SHOWTIME_MISMATCH', 400, 'The new seat must be in the same showtime as the ticket');
  if (request.scheduleId !== null && request.scheduleId !== schedule.id) mismatch();

  let target;
  if (request.seatId !== null) {
    if (!Number.isInteger(request.seatId) || request.seatId <= 0) fail('SEAT_NOT_FOUND', 404, 'Seat not found');
    target = await Ticket.findOne({ id: request.seatId });
    if (!target) fail('SEAT_NOT_FOUND', 404, 'Seat not found');
    if (target.schedule_id !== schedule.id) mismatch();
    if (request.seatCode && target.seat_code !== request.seatCode) {
      fail('SEAT_SWAP_SEAT_MISMATCH', 400, 'seat_id and seat_code name different seats');
    }
  } else {
    target = await Ticket.findOne({ schedule_id: schedule.id, seat_code: request.seatCode });
    if (!target) fail('SEAT_NOT_FOUND', 404, `Seat ${request.seatCode} does not exist in this showtime`);
  }
  if (target.id === fromTicket.id) fail('SEAT_SWAP_SAME_SEAT', 400, 'This ticket is already on that seat');

  const seatCodes = [target.seat_code];
  const seat = await Seat.findOne({ room_id: schedule.room_id, seat_code: target.seat_code }, { status: 1 });
  if (seat && seat.status === 'DISABLED') {
    fail('SEAT_DISABLED', 409, `Seat ${target.seat_code} is out of service`, { seatCodes });
  }
  // A hold that has lapsed is not a reason to refuse the seat.
  await bookingRepository.expireHeldTickets(schedule.id);
  const fresh = await Ticket.findOne({ id: target.id });
  if (!fresh || fresh.status !== Ticket.STATUS.AVAILABLE) {
    fail('SEAT_UNAVAILABLE', 409, `Seat ${target.seat_code} is not available`, { seatCodes });
  }
  return fresh;
}

// Both seats priced by the same pricing engine, in the same context (the booking owner's membership,
// this showtime), so the difference is exactly what the seats differ by. The client never sends one.
async function priceSwap(ctx, target, policy) {
  const { schedule, fromTicket, booking } = ctx;
  const prices = await bookingRepository.calculateTicketPrices(schedule, [fromTicket, target], booking.account_id);
  const oldPrice = prices.get(fromTicket.id)?.price ?? 0;
  const newPrice = prices.get(target.id)?.price ?? 0;
  const difference = newPrice - oldPrice;

  let refusal = null;
  if (difference > 0) {
    refusal = {
      code: 'SEAT_SWAP_UPGRADE_NOT_ALLOWED',
      message: `Seat ${target.seat_code} costs ${difference} more than your current seat; changing to a more expensive seat is not allowed`,
    };
  } else if (difference < 0 && policy.price_policy !== PRICE_POLICY.ALLOW_CHEAPER) {
    refusal = {
      code: 'SEAT_SWAP_PRICE_MISMATCH',
      message: `Seat ${target.seat_code} has a different price; only a seat of the same price can be chosen`,
    };
  }

  const quote = {
    from: { seat_id: fromTicket.id, seat_code: fromTicket.seat_code, seat_type: fromTicket.seat_type, price: oldPrice },
    to: { seat_id: target.id, seat_code: target.seat_code, seat_type: target.seat_type, price: newPrice },
    price_difference: difference,
    settlement: refusal ? null : difference === 0 ? NONE : NOT_REFUNDED,
    price_policy: policy.price_policy,
    allowed: !refusal,
  };
  if (refusal) fail(refusal.code, 400, refusal.message, { quote });
  return quote;
}

async function buildSwap({ invoiceId, caller, body, now }) {
  const request = readRequest(body);
  const ctx = await loadTicket({ invoiceId, caller });
  const policy = await assertSwappable(ctx, { now });
  const target = await resolveTarget(ctx, request);
  const quote = await priceSwap(ctx, target, policy);
  return { ctx, policy, target, quote };
}

// Request Seat Change: may this ticket change seat, under which policy, and what it is on now.
// Not-found / not-yours still throw; every other refusal is reported as `reason`, so the page can say
// why instead of offering a seat map that would only fail.
async function getSwapOptions({ invoiceId, caller, now = new Date() }) {
  const ctx = await loadTicket({ invoiceId, caller });
  let reason = null;
  let policy = null;
  try {
    policy = await assertSwappable(ctx, { now });
  } catch (err) {
    if (!(err instanceof SeatSwapError)) throw err;
    reason = { code: err.code, message: err.message };
  }
  if (!policy && ctx.booking) policy = await loadPolicy(ctx.booking.branch_id ?? null);

  const { invoice, fromTicket, schedule, booking } = ctx;
  let price = null;
  if (!reason) {
    const prices = await bookingRepository.calculateTicketPrices(schedule, [fromTicket], booking.account_id);
    price = prices.get(fromTicket.id)?.price ?? null;
  }
  return {
    ticket_id: invoice.id,
    eligible: !reason,
    reason,
    policy,
    seat: fromTicket ? { seat_id: fromTicket.id, seat_code: fromTicket.seat_code, seat_type: fromTicket.seat_type, price } : null,
    showtime: schedule
      ? { id: schedule.id, room_id: schedule.room_id, movie_date: schedule.movie_date, time_begin: schedule.time_begin }
      : null,
  };
}

// Check Availability: the same checks as the swap, without writing anything.
async function quoteSwap({ invoiceId, caller, body, now = new Date() }) {
  const { quote } = await buildSwap({ invoiceId, caller, body, now });
  return quote;
}

// Confirm -> Update Booking -> Update Ticket.
async function swapSeat({ invoiceId, caller, body, req = null, now = new Date() }) {
  const { ctx, policy, target, quote } = await buildSwap({ invoiceId, caller, body, now });
  const { invoice, booking, fromTicket, schedule } = ctx;

  const swap = {
    from_ticket_id: fromTicket.id,
    from_seat_code: fromTicket.seat_code,
    from_seat_type: fromTicket.seat_type,
    to_ticket_id: target.id,
    to_seat_code: target.seat_code,
    to_seat_type: target.seat_type,
    old_price: quote.from.price,
    new_price: quote.to.price,
    price_difference: quote.price_difference,
    settlement: quote.settlement,
    swapped_by: caller.accountId ?? null,
    swapped_at: now,
  };
  const result = await bookingRepository.swapInvoiceSeat({
    invoiceId: invoice.id,
    bookingId: booking.id,
    scheduleId: schedule.id,
    fromTicket,
    toTicket: target,
    // A new QR for the new seat: a screenshot of the old ticket must not keep working.
    qrToken: generateQrToken(),
    swap,
  });
  if (result.conflict === 'SEAT_TAKEN') {
    fail('SEAT_UNAVAILABLE', 409, `Seat ${target.seat_code} is not available`, { seatCodes: [target.seat_code] });
  }
  if (result.conflict) {
    fail('SEAT_SWAP_CONFLICT', 409, 'This ticket changed while its seat was being changed — reload it and try again');
  }

  await recordAudit({
    req,
    performedBy: caller.accountId ?? null,
    action: ACTION.TICKET_SEAT_SWAPPED,
    entityType: ENTITY_TYPE.TICKET,
    entityId: invoice.id,
    branchId: booking.branch_id ?? null,
    metadata: {
      booking_id: booking.id,
      booking_code: booking.code,
      schedule_id: schedule.id,
      from_seat: fromTicket.seat_code,
      to_seat: target.seat_code,
      old_price: swap.old_price,
      new_price: swap.new_price,
      price_difference: swap.price_difference,
      settlement: swap.settlement,
      price_policy: policy.price_policy,
      channel: caller.scope === 'OWN' ? 'CUSTOMER' : 'STAFF',
    },
  });

  const { view } = await bookingRepository.findTicketViewById(invoice.id);
  return { ticket: view, swap: { ...swap }, quote };
}

module.exports = {
  PRICE_POLICY,
  SeatSwapError,
  getSwapOptions,
  quoteSwap,
  swapSeat,
};
