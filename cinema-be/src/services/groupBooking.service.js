const Account = require('../models/Account');
const Booking = require('../models/Booking');
const Branch = require('../models/Branch');
const Combo = require('../models/Combo');
const ComboOrder = require('../models/ComboOrder');
const Movie = require('../models/Movie');
const Payment = require('../models/Payment');
const Promotion = require('../models/Promotion');
const PromotionUsage = require('../models/PromotionUsage');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Seat = require('../models/Seat');
const Ticket = require('../models/Ticket');
const Voucher = require('../models/Voucher');
const bookingRepository = require('../repositories/booking.repository');
const groupBookingRepository = require('../repositories/groupBooking.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const paymentRepository = require('../repositories/payment.repository');
const promotionRepository = require('../repositories/promotion.repository');
const voucherRepository = require('../repositories/voucher.repository');
const systemConfigService = require('./systemConfig.service');
const notificationService = require('./notification.service');
const loyaltyService = require('./loyaltyService');
const membershipService = require('./membership.service');
const { recordAudit, ACTION, ENTITY_TYPE } = require('./auditLog.service');
const { createMomoPaymentUrl, groupBookingRedirectUrl } = require('../utils/momo');
const { sendInvoiceEmail } = require('../utils/mailer');
const { broadcastSeatUpdate } = require('../utils/seatBroadcast');
const { emitToOwner, emitToAdmin, emitToAccount, emitToBranch } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');
const nextId = require('../utils/nextId');
const { isVoucherEligible, computeVoucherDiscount } = require('../utils/voucherPricing');
const { isPromotionEligible, computePromotionDiscount, pickBestPromotion } = require('../utils/promotionPricing');
const {
  GroupBookingError,
  fail,
  parseGroupBookingBody,
  ticketsOutsideShowtime,
  expandComboLines,
  seatLimits,
  assertSeatCount,
} = require('../utils/groupBooking');

const CHANNEL = 'GROUP';
const DISCOUNT_SOURCE = { GROUP_PROMOTION: 'GROUP_PROMOTION', PROMOTION_CODE: 'PROMOTION_CODE', VOUCHER: 'VOUCHER' };
const PAID_STATUSES = [Booking.STATUS.PAID, Booking.STATUS.COMPLETED];

function showtimeStartMs(schedule) {
  // movie_date + time_begin are LOCAL time everywhere in this codebase.
  return new Date(`${schedule.movie_date}T${schedule.time_begin}:00`).getTime();
}

// OWN: the caller's own booking. BRANCH: a booking at one of the caller's branches. ALL: any.
async function callerMayAccess({ accountId, scope }, booking) {
  if (scope === 'ALL') return true;
  if (scope === 'OWN') return booking.account_id === Number(accountId);
  if (scope === 'BRANCH') {
    const branchIds = await bookingRepository.resolveAccessibleBranchIds(accountId);
    return branchIds.includes(booking.branch_id);
  }
  return false;
}

async function loadAccessibleBooking(code, caller) {
  const booking = await groupBookingRepository.findByCode(code);
  // Someone else's booking answers exactly like a missing one: codes are sequential and guessable.
  if (!booking || !(await callerMayAccess(caller, booking))) fail('GROUP_BOOKING_NOT_FOUND', 404, 'Group booking not found');
  return booking;
}

// The showtime, the seats (all on that showtime, none out of service) and the combos (sold at that
// branch, still on sale). `unavailableSeats` = seats the caller cannot take right now.
async function loadOrder(input, accountId) {
  const schedule = await Schedule.findOne({ id: input.scheduleId });
  if (!schedule) fail('SCHEDULE_NOT_FOUND', 404, 'Showtime not found');
  if (schedule.status === 'CANCELLED') fail('SCHEDULE_CANCELLED', 400, 'This showtime has been cancelled');
  if (showtimeStartMs(schedule) <= Date.now()) fail('SHOWTIME_STARTED', 400, 'This showtime has already started');
  const saleBlock = await membershipService.checkSaleAccess({ schedule, accountId });
  if (saleBlock) {
    const { message, code, ...extra } = saleBlock.body;
    fail(code, saleBlock.status, message, extra);
  }

  const branchId = schedule.cinema_id ?? null;
  const [minSeats, maxSeats] = await Promise.all([
    systemConfigService.getValue('GROUP_BOOKING_MIN_SEATS', branchId),
    systemConfigService.getValue('GROUP_BOOKING_MAX_SEATS', branchId),
  ]);
  const limits = seatLimits(minSeats, maxSeats);
  assertSeatCount(input.ticketIds.length, limits);

  const found = await Ticket.find({ id: { $in: input.ticketIds } });
  const ticketById = new Map(found.map((t) => [t.id, t]));
  const missing = input.ticketIds.filter((id) => !ticketById.has(id));
  if (missing.length > 0) fail('SEAT_NOT_FOUND', 404, 'One or more seats do not exist', { ticketIds: missing });
  const stray = ticketsOutsideShowtime(found, schedule.id);
  if (stray.length > 0) {
    fail('SEATS_NOT_SAME_SHOWTIME', 400, 'All seats of a group booking must be on the same showtime', { ticketIds: stray });
  }
  const tickets = input.ticketIds.map((id) => ticketById.get(id));

  // A room-map seat taken out of service keeps an AVAILABLE grid ticket, so it is checked on its own.
  const disabled = await Seat.find(
    { room_id: schedule.room_id, seat_code: { $in: tickets.map((t) => t.seat_code) }, status: 'DISABLED' },
    { seat_code: 1 },
  );
  if (disabled.length > 0) {
    fail('SEAT_DISABLED', 409, 'One or more seats are out of service', { seatCodes: disabled.map((s) => s.seat_code) });
  }

  let comboLines = [];
  if (input.comboLines.length > 0) {
    const combos = await Combo.find({ id: { $in: input.comboLines.map((l) => l.combo_id) } });
    const comboById = new Map(combos.map((c) => [c.id, c]));
    const unavailable = input.comboLines
      .filter((l) => {
        const combo = comboById.get(l.combo_id);
        return !combo || !combo.active || combo.cinema_id !== schedule.cinema_id;
      })
      .map((l) => l.combo_id);
    if (unavailable.length > 0) {
      fail('COMBO_NOT_AVAILABLE', 400, 'One or more combos are not sold for this showtime', { comboIds: unavailable });
    }
    comboLines = input.comboLines.map((l) => ({ combo: comboById.get(l.combo_id), quantity: l.quantity }));
  }

  const unavailableSeats = tickets.filter((t) => !bookingRepository.isSeatCheckoutableBy(t, accountId)).map((t) => t.seat_code);
  return { schedule, tickets, comboLines, limits, unavailableSeats };
}

function ineligibleExtra(promotion, reason) {
  if (reason === 'PROMOTION_MIN_TICKETS_NOT_MET') return { minTickets: promotion.min_tickets };
  if (reason === 'PROMOTION_MIN_ORDER_NOT_MET') return { minimumOrderValue: promotion.minimum_order_value };
  return {};
}

// Seats + combos priced by the pricing engine, then at most one discount: the voucher or promotion
// code the customer typed (refused with its reason if it does not apply), else the best group
// promotion this order qualifies for.
async function priceOrder({ schedule }, input, accountId, { enforceStock }) {
  const comboIds = expandComboLines(input.comboLines);
  const priced = await bookingRepository.priceOrderItems({ ticketIds: input.ticketIds, comboIds, accountId, enforceStock });
  if (!priced) fail('PRICING_FAILED', 400, 'Unable to price this order');
  const { orderValue } = priced;
  const ticketCount = input.ticketIds.length;
  const context = {
    branchId: schedule.cinema_id,
    movieId: schedule.movie_id,
    showtimeId: schedule.id,
    comboIds,
    orderValue,
    ticketCount,
  };

  let discount = null;
  if (input.voucherCode) {
    const voucher = await Voucher.findOne({ code: input.voucherCode, active: true });
    const eligibility = isVoucherEligible(voucher, { cinemaId: schedule.cinema_id, orderValue, comboIds });
    if (!eligibility.eligible) fail(eligibility.reason, 400, 'This voucher cannot be applied to this order');
    const amount = computeVoucherDiscount(voucher, orderValue, { ticketPrices: priced.ticketPrices, combos: priced.combos });
    discount = { source: DISCOUNT_SOURCE.VOUCHER, code: voucher.code, name: voucher.code, amount, minTickets: null };
  } else if (input.promotionCode) {
    const promotion = await Promotion.findOne({ code: input.promotionCode });
    if (!promotion) fail('PROMOTION_NOT_FOUND', 404, 'Promotion code does not exist');
    const usage = await promotionRepository.findUsage(promotion.id, accountId);
    const eligibility = isPromotionEligible(promotion, { ...context, customerUsedCount: usage ? usage.count : 0 });
    if (!eligibility.eligible) {
      fail(eligibility.reason, 400, 'This promotion cannot be applied to this order', ineligibleExtra(promotion, eligibility.reason));
    }
    discount = {
      source: DISCOUNT_SOURCE.PROMOTION_CODE,
      code: promotion.code,
      name: promotion.name,
      amount: computePromotionDiscount(promotion, orderValue),
      minTickets: promotion.min_tickets ?? null,
    };
  } else {
    const now = new Date();
    const candidates = await Promotion.find({
      status: Promotion.STATUS.ACTIVE,
      min_tickets: { $gte: 2, $lte: ticketCount },
      start_at: { $lte: now },
      end_at: { $gte: now },
    });
    if (candidates.length > 0) {
      const usages = await PromotionUsage.find({ account_id: Number(accountId), promotion_id: { $in: candidates.map((p) => p.id) } });
      const best = pickBestPromotion(candidates, context, new Map(usages.map((u) => [u.promotion_id, u.count])));
      if (best) {
        discount = {
          source: DISCOUNT_SOURCE.GROUP_PROMOTION,
          code: best.promotion.code,
          name: best.promotion.name,
          amount: best.discount,
          minTickets: best.promotion.min_tickets,
        };
      }
    }
  }

  const discountAmount = discount ? Math.min(Math.max(discount.amount, 0), orderValue) : 0;
  if (discount) discount.amount = discountAmount;
  return {
    seatTotal: priced.seatTotal,
    comboTotal: priced.comboTotal,
    orderValue,
    discount,
    discountAmount,
    totalPrice: Math.max(orderValue - discountAmount, 0),
    voucherCode: discount && discount.source === DISCOUNT_SOURCE.VOUCHER ? discount.code : null,
    promotionCode: discount && discount.source !== DISCOUNT_SOURCE.VOUCHER ? discount.code : null,
    priceByTicketId: new Map(priced.ticketPriceRows.map((row) => [row.ticketId, row.price])),
    comboIds,
  };
}

function presentPricing(order, pricing) {
  return {
    seat_count: order.tickets.length,
    seats: order.tickets.map((t) => ({
      ticket_id: t.id,
      seat_code: t.seat_code,
      seat_type: t.seat_type,
      price: pricing.priceByTicketId.get(t.id) ?? 0,
    })),
    combos: order.comboLines.map(({ combo, quantity }) => ({
      combo_id: combo.id,
      name: combo.name,
      type: combo.type,
      unit_price: combo.price,
      quantity,
      line_total: combo.price * quantity,
    })),
    seat_total: pricing.seatTotal,
    combo_total: pricing.comboTotal,
    order_value: pricing.orderValue,
    discount: pricing.discount
      ? {
          source: pricing.discount.source,
          code: pricing.discount.code,
          name: pricing.discount.name,
          amount: pricing.discount.amount,
          min_tickets: pricing.discount.minTickets,
        }
      : null,
    total_price: pricing.totalPrice,
  };
}

// POST /api/group-bookings/quote — what checkout would charge right now, changing nothing. Seats the
// caller cannot take and combo stock shortfalls are reported instead of refused, so the page can say so.
async function quote({ accountId, body }) {
  const input = parseGroupBookingBody(body);
  await bookingRepository.expireHeldTickets(input.scheduleId);
  const order = await loadOrder(input, accountId);
  const pricing = await priceOrder(order, input, accountId, { enforceStock: false });

  let stockShortages = [];
  if (pricing.comboIds.length > 0 && order.schedule.cinema_id != null) {
    try {
      await inventoryRepository.assertAvailableForComboIds(order.schedule.cinema_id, pricing.comboIds);
    } catch (err) {
      if (!err.shortages) throw err;
      stockShortages = err.shortages;
    }
  }

  return {
    schedule_id: order.schedule.id,
    ...presentPricing(order, pricing),
    unavailable_seat_codes: order.unavailableSeats,
    stock_shortages: stockShortages,
    limits: { min_seats: order.limits.minSeats, max_seats: order.limits.maxSeats },
  };
}

// The same Idempotency-Key again: the booking the first request made, never a second one. A key reused
// for a different order (or by someone else) is refused rather than answered with that booking.
async function replay(existing, accountId, input) {
  const sameOrder =
    existing.account_id === Number(accountId) &&
    existing.booking_type === Booking.TYPE.GROUP &&
    existing.schedule_id === input.scheduleId &&
    [...existing.ticket_ids].sort((a, b) => a - b).join(',') === [...input.ticketIds].sort((a, b) => a - b).join(',');
  if (!sameOrder) {
    fail('IDEMPOTENCY_KEY_REUSED', 409, 'This Idempotency-Key was already used for a different order');
  }
  const payment = await paymentRepository.findByCode(existing.code);
  if (existing.status === Booking.STATUS.PENDING && !(payment && payment.pay_url)) {
    fail('CHECKOUT_IN_PROGRESS', 409, 'This checkout is still being processed, please retry in a moment');
  }
  return { created: false, booking: await presentBooking(existing, { includePayUrl: true }), pay_url: payment?.pay_url ?? null };
}

// POST /api/group-bookings — Idempotency-Key header recommended (a double-click or a network retry
// then returns the same booking and payment link).
async function checkout({ accountId, body, idempotencyKey = null, req = null }) {
  const input = parseGroupBookingBody(body);
  if (idempotencyKey) {
    const existing = await groupBookingRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) return replay(existing, accountId, input);
  }

  await bookingRepository.expireHeldTickets(input.scheduleId);
  const order = await loadOrder(input, accountId);
  if (order.unavailableSeats.length > 0) {
    fail('SEAT_UNAVAILABLE', 409, 'One or more seats are no longer available', { seatCodes: order.unavailableSeats });
  }
  const pricing = await priceOrder(order, input, accountId, { enforceStock: true });

  const { schedule } = order;
  const holdMinutes = await systemConfigService.getValue('BOOKING_HOLD_TIME', schedule.cinema_id ?? null);
  const expiresAt = new Date(Math.min(Date.now() + holdMinutes * 60 * 1000, showtimeStartMs(schedule)));
  const code = `GB-${await nextId('groupBookingOrder')}`;

  const result = await groupBookingRepository.createPending({
    code,
    accountId,
    schedule,
    ticketIds: input.ticketIds,
    comboIds: pricing.comboIds,
    pricing,
    group: { ...input.organizer, auto_discount: pricing.discount?.source === DISCOUNT_SOURCE.GROUP_PROMOTION },
    expiresAt,
    idempotencyKey,
  });
  if (result.duplicateKey) {
    const existing = await groupBookingRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) return replay(existing, accountId, input);
    fail('CHECKOUT_IN_PROGRESS', 409, 'This checkout is still being processed, please retry in a moment');
  }
  if (result.conflict) {
    const lost = new Set(result.conflict);
    fail('SEAT_UNAVAILABLE', 409, 'One or more seats are no longer available', {
      seatCodes: order.tickets.filter((t) => lost.has(t.id)).map((t) => t.seat_code),
    });
  }

  const { booking, payment } = result;
  broadcastSeatUpdate(order.tickets, 'HELD');

  let payUrl;
  try {
    payUrl = await createMomoPaymentUrl(
      booking.total_price,
      code,
      { bookingId: booking.id, accountId: Number(accountId), groupBooking: true },
      { redirectUrl: groupBookingRedirectUrl(), orderInfo: 'Pay for group cinema booking' },
    );
  } catch (err) {
    // Nothing to pay with, so nothing may stay locked: the whole booking is released.
    console.error('[groupBooking] MoMo payment link failed', code, err.message);
    await paymentRepository.markFailedIfPending(code, 'Payment link could not be created');
    await bookingRepository.cancelPendingGroupBooking(code, { reason: 'Payment link could not be created' });
    fail('PAYMENT_GATEWAY_UNAVAILABLE', 502, 'The payment gateway is unavailable, please try again');
  }
  await paymentRepository.setPayUrl(payment.id, payUrl);

  await recordAudit({
    req,
    performedBy: Number(accountId),
    action: ACTION.CREATE_BOOKING,
    entityType: ENTITY_TYPE.BOOKING,
    entityId: booking.id,
    branchId: booking.branch_id,
    metadata: {
      code,
      channel: CHANNEL,
      seats: booking.ticket_ids.length,
      combos: booking.combo_ids.length,
      organizerType: booking.group.organizer_type,
      discountSource: pricing.discount?.source ?? null,
      promotionCode: pricing.promotionCode,
      totalPrice: booking.total_price,
    },
  });
  await notificationService.notify({
    event: notificationService.EVENT.BOOKING_CREATED,
    accountId: Number(accountId),
    bookingId: booking.id,
  });

  return { created: true, booking: await presentBooking(booking, { includePayUrl: true }), pay_url: payUrl };
}

// Everything that follows a confirmed payment — only ever run by the one call that issued the tickets.
// None of it may undo the sale, so each step is best-effort.
async function afterTicketsIssued(booking, payment) {
  const tickets = await Ticket.find({ id: { $in: booking.ticket_ids } });
  broadcastSeatUpdate(tickets, 'BOOKED');
  const accountId = booking.account_id;

  try {
    if (booking.voucher_code) {
      const voucher = await Voucher.findOne({ code: booking.voucher_code });
      const recorded = voucher
        ? await voucherRepository.recordUsage({
            voucherId: voucher.id,
            accountId,
            bookingId: booking.id,
            discountAmount: booking.discount_amount,
          })
        : null;
      if (recorded) {
        await recordAudit({
          performedBy: accountId,
          action: ACTION.VOUCHER_USED,
          entityType: ENTITY_TYPE.VOUCHER,
          entityId: voucher.id,
          branchId: booking.branch_id,
          metadata: { code: voucher.code, bookingId: booking.id, discountAmount: booking.discount_amount },
        });
      }
    } else if (booking.promotion_code) {
      const promotion = await Promotion.findOne({ code: booking.promotion_code });
      if (promotion) await promotionRepository.recordUsage(promotion.id, accountId);
    }
  } catch (err) {
    console.error(`[groupBooking] discount usage not recorded for ${booking.code}:`, err.message);
  }

  try {
    await loyaltyService.earnPointsForBooking({
      accountId,
      bookingId: booking.id,
      amount: booking.total_price,
      description: `Group booking ${booking.code}`,
    });
  } catch (err) {
    console.error(`[groupBooking] loyalty points not awarded for ${booking.code}:`, err.message);
  }

  if (booking.combo_ids.length > 0) {
    try {
      // The kitchen gets one order for the whole group (quantities summed per combo).
      if (!(await ComboOrder.exists({ booking_id: booking.id }))) {
        await bookingRepository.createLinkedComboOrder({
          bookingId: booking.id,
          branchId: booking.branch_id,
          accountId,
          comboIds: booking.combo_ids,
          createdBy: null,
          paymentMethod: Payment.METHOD.MOMO,
        });
      }
    } catch (err) {
      console.error(`[groupBooking] combo order not created for ${booking.code}:`, err.message);
    }
  }

  try {
    const account = await Account.findOne({ id: accountId });
    if (account) {
      await sendInvoiceEmail(account.email, {
        seats: tickets.map((t) => t.seat_code),
        schedule_id: booking.schedule_id,
        price: booking.total_price,
      });
    }
  } catch (err) {
    console.error(`[groupBooking] invoice email not sent for ${booking.code}:`, err.message);
  }

  const branch = await Branch.findOne({ id: booking.branch_id });
  if (branch) {
    emitToOwner(branch.owner_id, REALTIME_EVENT.BOOKING_NEW, { branchId: branch.id, amount: booking.total_price });
    emitToAdmin(REALTIME_EVENT.BOOKING_NEW, { branchId: branch.id, amount: booking.total_price });
    emitToBranch(branch.id, REALTIME_EVENT.BOOKING_UPDATED, {
      action: REALTIME_ACTION.CREATED,
      bookingId: booking.id,
      code: booking.code,
      branchId: branch.id,
      scheduleId: booking.schedule_id,
    });
  }
  emitToAccount(accountId, REALTIME_EVENT.BOOKING_UPDATED, {
    action: REALTIME_ACTION.STATUS_CHANGED,
    bookingId: booking.id,
    code: booking.code,
    status: booking.status,
  });

  await recordAudit({
    performedBy: accountId,
    action: ACTION.PAYMENT_SUCCESS,
    entityType: ENTITY_TYPE.PAYMENT,
    entityId: payment.id,
    branchId: booking.branch_id,
    metadata: { code: booking.code, channel: CHANNEL, method: payment.method, amount: payment.amount },
  });
  await recordAudit({
    performedBy: accountId,
    action: ACTION.TICKET_ISSUED,
    entityType: ENTITY_TYPE.TICKET,
    entityId: booking.id,
    branchId: booking.branch_id,
    metadata: { code: booking.code, channel: CHANNEL, count: booking.ticket_ids.length },
  });
  const channels = [notificationService.CHANNEL.IN_APP, notificationService.CHANNEL.EMAIL];
  await notificationService.notify({
    event: notificationService.EVENT.PAYMENT_SUCCESS,
    accountId,
    bookingId: booking.id,
    data: { amount: payment.amount },
    channels,
  });
  await notificationService.notify({
    event: notificationService.EVENT.TICKET_ISSUED,
    accountId,
    bookingId: booking.id,
    channels,
  });
}

// A signature-verified MoMo result for a group booking — from the IPN, its webhook-retry replay or the
// customer's browser, in any order and any number of times. Returns { handled: false } for any other
// order code. Every transition is guarded by the current state, so a repeat changes nothing:
//   success -> payment PAID, then finalizePaid issues every ticket exactly once. A payment that is PAID
//              but whose tickets were never issued (the first confirmation failed part-way) is finished
//              by whichever confirmation comes next. If the booking can no longer be honoured
//              (cancelled meanwhile, or a seat lost after the hold lapsed) the money goes to REFUND_PENDING.
//   failure -> payment FAILED, booking CANCELLED, every seat still held for it released.
async function applyMomoOutcome(body, { req = null } = {}) {
  const code = String(body.orderId);
  const booking = await groupBookingRepository.findByCode(code);
  if (!booking) return { handled: false };

  await paymentRepository.markProcessing(code);

  if (String(body.resultCode) !== '0') {
    const failed = await paymentRepository.markFailedIfPending(code, `MoMo resultCode ${body.resultCode}`);
    await bookingRepository.cancelPendingGroupBooking(code, { reason: 'Payment failed' });
    if (failed) {
      await recordAudit({
        req,
        performedBy: booking.account_id,
        action: ACTION.PAYMENT_FAILED,
        entityType: ENTITY_TYPE.PAYMENT,
        entityId: failed.id,
        branchId: booking.branch_id,
        metadata: { code, channel: CHANNEL, resultCode: body.resultCode ?? null },
      });
      await notificationService.notify({
        event: notificationService.EVENT.PAYMENT_FAILED,
        accountId: booking.account_id,
        bookingId: booking.id,
        data: { bookingCode: code },
      });
    }
    return { handled: true, success: false, booking: await groupBookingRepository.findByCode(code) };
  }

  const { skip, payment } = await paymentRepository.markPaidIfPending(code, {
    gatewayTransactionId: body.transId ? String(body.transId) : null,
    rawResponse: body,
  });
  if (!payment || payment.status !== Payment.STATUS.PAID) {
    // Already failed, or already sent back for a refund: nothing more to do.
    return { handled: true, success: false, alreadyProcessed: true, booking: await groupBookingRepository.findByCode(code) };
  }

  const result = await groupBookingRepository.finalizePaid(code);
  if (result.issued) {
    await afterTicketsIssued(result.booking, payment);
    return { handled: true, success: true, alreadyProcessed: false, booking: result.booking };
  }
  if (result.alreadyPaid) return { handled: true, success: true, alreadyProcessed: true, booking: result.booking };

  // Paid for a booking that can no longer be honoured: the money must go back.
  const reason = result.seatsLost ? 'Seats no longer available at payment' : 'Booking was no longer payable';
  const refund = await paymentRepository.requestRefund(payment.id, reason);
  if (refund) {
    await recordAudit({
      req,
      performedBy: booking.account_id,
      action: ACTION.BOOKING_REFUND_REQUESTED,
      entityType: ENTITY_TYPE.BOOKING,
      entityId: booking.id,
      branchId: booking.branch_id,
      reason,
      metadata: { code, channel: CHANNEL, amount: payment.amount, lostTicketIds: result.seatsLost ?? [] },
    });
  }
  return {
    handled: true,
    success: false,
    alreadyProcessed: skip,
    refundPending: true,
    reason: result.seatsLost ? 'SEATS_LOST' : 'BOOKING_NOT_PAYABLE',
    booking: result.booking || (await groupBookingRepository.findByCode(code)),
  };
}

// POST /api/group-bookings/:code/momo-confirm — the browser is back from MoMo (the IPN may already
// have applied the same result). Only the booking's own customer may post it.
async function confirmFromBrowser({ code, caller, body }) {
  if (String(body.orderId) !== String(code)) fail('ORDER_MISMATCH', 400, 'This payment result is for a different order');
  const booking = await groupBookingRepository.findByCode(code);
  if (!booking || booking.account_id !== Number(caller.accountId)) fail('GROUP_BOOKING_NOT_FOUND', 404, 'Group booking not found');
  const result = await applyMomoOutcome(body);
  return {
    success: result.success,
    already_processed: Boolean(result.alreadyProcessed),
    refund_pending: Boolean(result.refundPending),
    reason: result.reason ?? null,
    booking: await presentBooking(result.booking || booking, { includePayUrl: false }),
  };
}

// POST /api/group-bookings/:code/cancel — gives up a PENDING group booking: every seat is released at
// once. The payment row stays PENDING on purpose: if the customer still completes the MoMo page, that
// money arrives for a cancelled booking and is flagged REFUND_PENDING instead of being lost.
async function cancel({ code, caller, reason = null, req = null }) {
  const booking = await loadAccessibleBooking(code, caller);
  if (booking.status !== Booking.STATUS.PENDING) {
    fail('BOOKING_NOT_CANCELLABLE', 409, `A ${booking.status.toLowerCase()} group booking cannot be cancelled here`, {
      status: booking.status,
    });
  }
  const cancelled = await bookingRepository.cancelPendingGroupBooking(code, { reason: reason || 'Cancelled by customer' });
  if (!cancelled) {
    const current = await groupBookingRepository.findByCode(code);
    fail('BOOKING_NOT_CANCELLABLE', 409, `A ${current.status.toLowerCase()} group booking cannot be cancelled here`, {
      status: current.status,
    });
  }
  await recordAudit({
    req,
    action: ACTION.CANCEL_BOOKING,
    entityType: ENTITY_TYPE.BOOKING,
    entityId: cancelled.id,
    branchId: cancelled.branch_id,
    reason: cancelled.cancel_reason,
    metadata: { code, channel: CHANNEL, previousStatus: Booking.STATUS.PENDING, seats: cancelled.ticket_ids.length },
  });
  await notificationService.notify({
    event: notificationService.EVENT.BOOKING_CANCELLED,
    accountId: cancelled.account_id,
    bookingId: cancelled.id,
    data: { reason: cancelled.cancel_reason },
  });
  return presentBooking(cancelled, { includePayUrl: false });
}

// GET /api/group-bookings/:code
async function getForCaller({ code, caller }) {
  const booking = await loadAccessibleBooking(code, caller);
  return presentBooking(booking, { includePayUrl: booking.account_id === Number(caller.accountId) });
}

// The booking as the group pages show it: seats, combo lines, showtime, organizer, money, payment and
// (once paid) the issued tickets.
async function presentBooking(booking, { includePayUrl = false } = {}) {
  const [tickets, schedule, payment] = await Promise.all([
    Ticket.find({ id: { $in: booking.ticket_ids } }),
    Schedule.findOne({ id: booking.schedule_id }),
    Payment.findOne({ code: booking.code }),
  ]);
  const [movie, room, branch] = await Promise.all([
    schedule ? Movie.findOne({ id: schedule.movie_id }) : null,
    schedule ? Room.findOne({ id: schedule.room_id }) : null,
    Branch.findOne({ id: booking.branch_id }),
  ]);

  const quantityById = new Map();
  for (const id of booking.combo_ids) quantityById.set(id, (quantityById.get(id) || 0) + 1);
  const combos = quantityById.size > 0 ? await Combo.find({ id: { $in: [...quantityById.keys()] } }) : [];
  const comboById = new Map(combos.map((c) => [c.id, c]));

  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const invoices = PAID_STATUSES.includes(booking.status) ? await groupBookingRepository.findInvoices(booking.id) : [];

  return {
    id: booking.id,
    code: booking.code,
    booking_type: booking.booking_type,
    status: booking.status,
    account_id: booking.account_id,
    branch_id: booking.branch_id,
    schedule_id: booking.schedule_id,
    group: booking.group,
    seats: booking.ticket_ids.map((id) => {
      const ticket = ticketById.get(id);
      return { ticket_id: id, seat_code: ticket?.seat_code ?? null, seat_type: ticket?.seat_type ?? null };
    }),
    combos: [...quantityById].map(([comboId, quantity]) => {
      const combo = comboById.get(comboId);
      return {
        combo_id: comboId,
        name: combo?.name ?? null,
        unit_price: combo?.price ?? null,
        quantity,
        line_total: combo ? combo.price * quantity : null,
      };
    }),
    seat_total: booking.seat_total,
    combo_total: booking.combo_total,
    discount_amount: booking.discount_amount,
    promotion_code: booking.promotion_code,
    voucher_code: booking.voucher_code,
    total_price: booking.total_price,
    expires_at: booking.expires_at,
    paid_at: booking.paid_at,
    cancelled_at: booking.cancelled_at,
    cancel_reason: booking.cancel_reason,
    createdAt: booking.createdAt,
    payment: payment
      ? {
          status: payment.status,
          method: payment.method,
          amount: payment.amount,
          pay_url: includePayUrl && booking.status === Booking.STATUS.PENDING ? payment.pay_url : null,
        }
      : null,
    tickets: invoices.map((inv) => ({
      ticket_id: inv.id,
      seat_code: ticketById.get(inv.ticket_id)?.seat_code ?? null,
      status: inv.ticket_status,
    })),
    schedule: schedule
      ? { id: schedule.id, movie_date: schedule.movie_date, time_begin: schedule.time_begin, time_end: schedule.time_end }
      : null,
    movie: movie ? { id: movie.id, name: movie.name, avatar: movie.avatar } : null,
    room: room ? { id: room.id, name: room.name } : null,
    branch: branch ? { id: branch.id, name: branch.name } : null,
  };
}

module.exports = {
  GroupBookingError,
  DISCOUNT_SOURCE,
  isGroupBookingCode: groupBookingRepository.isGroupBookingCode,
  quote,
  checkout,
  applyMomoOutcome,
  confirmFromBrowser,
  cancel,
  getForCaller,
};
