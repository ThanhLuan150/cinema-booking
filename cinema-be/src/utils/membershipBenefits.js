const { BENEFIT_LIMITS, DEFAULT_BENEFITS } = require('../models/membershipBenefits');
const { DEFAULT_TIMEZONE, workDateFor, parseOffsetTimestamp } = require('./attendanceTime');

const HOUR_MS = 60 * 60 * 1000;
const BENEFIT_FIELDS = Object.keys(DEFAULT_BENEFITS);

// A stored benefit block (Mongoose subdoc, plain object, or nothing) with every field present.
function normalizeBenefits(raw) {
  const source = raw && typeof raw.toObject === 'function' ? raw.toObject() : raw || {};
  const out = {};
  for (const field of BENEFIT_FIELDS) {
    const value = source[field];
    out[field] = value === undefined || (value === null && !BENEFIT_LIMITS[field].nullable) ? DEFAULT_BENEFITS[field] : value;
  }
  return out;
}

// Validates an admin-supplied (possibly partial) benefit block. Returns { benefits } holding only
// the fields that were sent, or { errors: [{ field, message }] }. Unknown fields are refused so a
// typo ("free_ticket") never silently does nothing.
function validateBenefitsInput(input) {
  if (input === undefined) return { benefits: {} };
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: [{ field: 'benefits', message: 'benefits must be an object' }] };
  }
  const errors = [];
  const benefits = {};
  for (const [field, raw] of Object.entries(input)) {
    const limits = BENEFIT_LIMITS[field];
    if (!limits) {
      errors.push({ field, message: `unknown benefit "${field}"` });
      continue;
    }
    if (raw === null && limits.nullable) {
      benefits[field] = null;
      continue;
    }
    const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push({ field, message: `${field} must be a number` });
      continue;
    }
    if (limits.integer && !Number.isInteger(value)) {
      errors.push({ field, message: `${field} must be a whole number` });
      continue;
    }
    if (limits.min !== undefined && value < limits.min) {
      errors.push({ field, message: `${field} must be at least ${limits.min}` });
      continue;
    }
    if (limits.max !== undefined && value > limits.max) {
      errors.push({ field, message: `${field} must be at most ${limits.max}` });
      continue;
    }
    benefits[field] = value;
  }
  return errors.length > 0 ? { errors } : { benefits };
}

// A subscription gives benefits only while it is ACTIVE *and* inside its term. Status alone is not
// trusted: the expiry sweep may not have run yet when a lapsed subscription is used.
function isSubscriptionLive(subscription, now = new Date()) {
  if (!subscription || subscription.status !== 'ACTIVE') return false;
  if (!subscription.start_at || !subscription.end_at) return false;
  const at = now.getTime();
  return new Date(subscription.start_at).getTime() <= at && at < new Date(subscription.end_at).getTime();
}

// Tier + subscription -> what the customer actually gets. Percentages, priority and the points
// multiplier are best-of (never stacked). Free tickets are NOT combined here: each source keeps its
// own allowance and usage counter (see buildFreeTicketPools).
function combineBenefits(levelBenefits, subscriptionBenefits = null) {
  const tier = normalizeBenefits(levelBenefits);
  const plan = subscriptionBenefits ? normalizeBenefits(subscriptionBenefits) : null;
  if (!plan) {
    return {
      ticket_discount_percent: tier.ticket_discount_percent,
      fnb_discount_percent: tier.fnb_discount_percent,
      priority_booking_hours: tier.priority_booking_hours,
      points_multiplier: tier.points_multiplier,
    };
  }
  return {
    ticket_discount_percent: Math.max(tier.ticket_discount_percent, plan.ticket_discount_percent),
    fnb_discount_percent: Math.max(tier.fnb_discount_percent, plan.fnb_discount_percent),
    priority_booking_hours: Math.max(tier.priority_booking_hours, plan.priority_booking_hours),
    points_multiplier: Math.max(tier.points_multiplier, plan.points_multiplier),
  };
}

// The calendar month a tier's free-ticket allowance is counted in, cut in the business timezone
// (never the host's zone or UTC, so the month turns over at local midnight on every server).
function periodKey(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  return workDateFor(now, timeZone).slice(0, 7);
}

// Free-ticket allowances in the order they are spent: the live subscription first (it was paid
// for and runs out at the end of its term), then the tier's monthly allowance.
function buildFreeTicketPools({ subscription = null, subscriptionBenefits = null, tierBenefits = null, tierUsed = 0, period = null }) {
  const pools = [];
  if (subscription && subscriptionBenefits) {
    const benefits = normalizeBenefits(subscriptionBenefits);
    pools.push({
      source: 'SUBSCRIPTION',
      subscription_id: subscription.id,
      limit: benefits.free_tickets,
      used: Number(subscription.tickets_used) || 0,
      remaining: Math.max(benefits.free_tickets - (Number(subscription.tickets_used) || 0), 0),
      max_value: benefits.free_ticket_max_value,
    });
  }
  if (tierBenefits) {
    const benefits = normalizeBenefits(tierBenefits);
    if (benefits.free_tickets > 0) {
      pools.push({
        source: 'TIER',
        period,
        limit: benefits.free_tickets,
        used: Number(tierUsed) || 0,
        remaining: Math.max(benefits.free_tickets - (Number(tierUsed) || 0), 0),
        max_value: benefits.free_ticket_max_value,
      });
    }
  }
  return pools;
}

function percentOf(amount, percent) {
  if (!(percent > 0) || !(amount > 0)) return 0;
  return Math.min(Math.round((amount * percent) / 100), amount);
}

// Applies the membership to an already-priced order.
//   ticketRows  [{ ticketId, price }]  seat prices from the pricing engine
//   combos      [{ id, price }]        one entry per item (a repeated combo id is a quantity)
//   effective   combineBenefits(...)
//   pools       buildFreeTicketPools(...)
//   freeTickets how many seats the customer asked to cover with free tickets
// Free tickets cover the dearest seats first (each up to its pool's max_value); the ticket
// percentage then applies to what is left of every seat, and the F&B percentage to every item.
// Returns the per-line prices after the membership, so a voucher/promotion is computed on what the
// customer still pays, never on the list price.
function computeMembershipPricing({ ticketRows = [], combos = [], effective = {}, pools = [], freeTickets = 0 }) {
  const requested = Math.max(0, Math.floor(Number(freeTickets) || 0));
  const remainingByPool = pools.map((p) => p.remaining);
  const coverable = ticketRows
    .filter((row) => row.price > 0)
    .sort((a, b) => b.price - a.price || a.ticketId - b.ticketId);

  const allocations = [];
  const coveredByTicket = new Map();
  for (const row of coverable) {
    if (allocations.length >= requested) break;
    const poolIndex = remainingByPool.findIndex((left) => left > 0);
    if (poolIndex === -1) break;
    const pool = pools[poolIndex];
    const amount = pool.max_value === null || pool.max_value === undefined ? row.price : Math.min(row.price, pool.max_value);
    remainingByPool[poolIndex] -= 1;
    coveredByTicket.set(row.ticketId, amount);
    allocations.push({
      ticketId: row.ticketId,
      amount,
      source: pool.source,
      subscription_id: pool.subscription_id ?? null,
      period: pool.period ?? null,
    });
  }

  const ticketPercent = Number(effective.ticket_discount_percent) || 0;
  const fnbPercent = Number(effective.fnb_discount_percent) || 0;
  let ticketDiscount = 0;
  const adjustedTicketRows = ticketRows.map((row) => {
    const covered = coveredByTicket.get(row.ticketId) || 0;
    const discount = percentOf(row.price - covered, ticketPercent);
    ticketDiscount += discount;
    return { ticketId: row.ticketId, price: row.price - covered - discount };
  });
  let fnbDiscount = 0;
  const adjustedCombos = combos.map((combo) => {
    const discount = percentOf(combo.price, fnbPercent);
    fnbDiscount += discount;
    return { id: combo.id, price: combo.price - discount };
  });

  const freeTicketAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
  const totalAvailable = pools.reduce((sum, p) => sum + p.remaining, 0);
  return {
    freeTicketsRequested: requested,
    freeTicketsApplied: allocations.length,
    // How many seats of THIS order a free ticket could still cover.
    freeTicketsAvailable: Math.min(totalAvailable, coverable.length),
    allocations,
    freeTicketAmount,
    ticketDiscountPercent: ticketPercent,
    ticketDiscount,
    fnbDiscountPercent: fnbPercent,
    fnbDiscount,
    membershipDiscount: freeTicketAmount + ticketDiscount + fnbDiscount,
    adjustedTicketRows,
    adjustedCombos,
  };
}

// Priority Booking. A showtime with no sale_opens_at is on sale to everyone. Otherwise the general
// public may book from sale_opens_at, and a member with priority_booking_hours = H from H hours
// before it. Returns { open, opensAt } — opensAt is when THIS customer may book (null when open).
function checkSaleWindow({ saleOpensAt, priorityHours = 0, now = new Date() }) {
  if (!saleOpensAt) return { open: true, opensAt: null, priority: false };
  const general = new Date(saleOpensAt).getTime();
  if (Number.isNaN(general) || now.getTime() >= general) return { open: true, opensAt: null, priority: false };
  const hours = Number(priorityHours) || 0;
  const memberOpens = general - hours * HOUR_MS;
  if (hours > 0 && now.getTime() >= memberOpens) return { open: true, opensAt: null, priority: true };
  return { open: false, opensAt: new Date(hours > 0 ? memberOpens : general), generalOpensAt: new Date(general), priority: false };
}

// Admin input for Schedule.sale_opens_at: null/'' clears it, otherwise an ISO-8601 instant WITH an
// offset (a bare local time would be read in whatever zone the server happens to run in).
function parseSaleOpensAt(raw) {
  if (raw === undefined) return { skip: true };
  if (raw === null || raw === '') return { value: null };
  const parsed = raw instanceof Date ? raw : parseOffsetTimestamp(String(raw));
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { error: 'sale_opens_at must be an ISO-8601 timestamp with a timezone offset, or null' };
  }
  return { value: parsed };
}

module.exports = {
  BENEFIT_FIELDS,
  normalizeBenefits,
  validateBenefitsInput,
  isSubscriptionLive,
  combineBenefits,
  periodKey,
  buildFreeTicketPools,
  computeMembershipPricing,
  checkSaleWindow,
  parseSaleOpensAt,
};
