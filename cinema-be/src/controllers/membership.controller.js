const bookingRepository = require('../repositories/booking.repository');
const membershipService = require('../services/membership.service');
const { ticketsOutsideShowtime } = require('../utils/groupBooking');

// GET /api/membership/me -> the caller's own tier, benefits, subscription and free tickets left.
// There is no account id anywhere in the request: a customer can only ever see their own.
async function me(req, res) {
  const membership = await membershipService.getMyMembership(req.account.accountId);
  if (!membership) return res.status(404).json({ message: 'Account not found' });
  res.json(membership);
}

function parseFreeTickets(raw, seatCount) {
  if (raw === undefined || raw === null || raw === '') return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= seatCount ? value : null;
}

// POST /api/membership/me/preview { ticketIds, comboIds, freeTickets, voucherCode | promotionCode }
// -> exactly what the checkout would charge, with the membership part spelled out. Read-only:
// nothing is reserved, and the checkout prices the order again from scratch.
async function preview(req, res) {
  const { ticketIds, comboIds, voucherCode, promotionCode } = req.body || {};
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
    return res.status(400).json({ message: 'ticketIds is required', code: 'VALIDATION_ERROR' });
  }
  if (voucherCode && promotionCode) {
    return res.status(400).json({ message: 'Cannot apply both a voucher and a promotion to the same order', code: 'DISCOUNT_CONFLICT' });
  }
  const freeTickets = parseFreeTickets(req.body.freeTickets, ticketIds.length);
  if (freeTickets === null) {
    return res.status(400).json({
      message: 'freeTickets must be a whole number between 0 and the number of seats',
      code: 'INVALID_FREE_TICKETS',
    });
  }

  const tickets = await bookingRepository.findTicketsByIds(ticketIds.map(Number));
  if (tickets.length !== new Set(ticketIds.map(Number)).size) {
    return res.status(404).json({ message: 'One or more seats do not exist', code: 'SEAT_NOT_FOUND' });
  }
  const stray = ticketsOutsideShowtime(tickets, tickets[0].schedule_id);
  if (stray.length > 0) {
    return res.status(400).json({ message: 'All seats of a booking must be on the same showtime', code: 'SEATS_NOT_SAME_SHOWTIME', ticketIds: stray });
  }

  const accountId = req.account.accountId;
  const pricing = await bookingRepository.computeOrderPricing({
    ticketIds: ticketIds.map(Number),
    comboIds: Array.isArray(comboIds) ? comboIds : [],
    voucherCode: voucherCode || null,
    promotionCode: promotionCode || null,
    accountId,
    freeTickets,
    enforceStock: false,
  });
  if (!pricing) return res.status(400).json({ message: 'Unable to price this order', code: 'PRICING_FAILED' });

  const member = pricing.membership;
  const snapshot = member ? member.pricing : null;
  const schedule = await bookingRepository.findScheduleById(tickets[0].schedule_id);
  res.json({
    seat_total: pricing.seatTotal,
    combo_total: pricing.comboTotal,
    order_value: pricing.seatTotal + pricing.comboTotal,
    membership: {
      level: member ? member.state.account.membership_level : 'NONE',
      subscription_id: member && member.state.subscription ? member.state.subscription.id : null,
      free_tickets: {
        requested: freeTickets,
        applied: snapshot ? snapshot.freeTicketsApplied : 0,
        available: snapshot ? snapshot.freeTicketsAvailable : 0,
      },
      covered_ticket_ids: snapshot ? snapshot.allocations.map((a) => a.ticketId) : [],
      free_ticket_amount: snapshot ? snapshot.freeTicketAmount : 0,
      ticket_discount_percent: snapshot ? snapshot.ticketDiscountPercent : 0,
      ticket_discount_amount: snapshot ? snapshot.ticketDiscount : 0,
      fnb_discount_percent: snapshot ? snapshot.fnbDiscountPercent : 0,
      fnb_discount_amount: snapshot ? snapshot.fnbDiscount : 0,
      total: pricing.membershipDiscount,
    },
    value_after_membership: pricing.seatTotal + pricing.comboTotal - pricing.membershipDiscount,
    code_discount: pricing.codeDiscount,
    voucher_code: pricing.voucherCode,
    promotion_code: pricing.promotionCode,
    total_price: pricing.totalPrice,
    sale: await membershipService.describeSaleAccess({ schedule, accountId }),
  });
}

// GET /api/membership/me/sale-access/:scheduleId -> may the caller book this showtime yet?
async function saleAccess(req, res) {
  const schedule = await bookingRepository.findScheduleById(Number(req.params.scheduleId));
  if (!schedule) return res.status(404).json({ message: 'Schedule not found', code: 'SCHEDULE_NOT_FOUND' });
  res.json(await membershipService.describeSaleAccess({ schedule, accountId: req.account.accountId }));
}

module.exports = { me, preview, saleAccess };
