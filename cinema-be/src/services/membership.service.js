const Account = require('../models/Account');
const MembershipBenefitUsage = require('../models/MembershipBenefitUsage');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const loyaltyService = require('./loyaltyService');
const membershipBenefitRepository = require('../repositories/membershipBenefit.repository');
const paymentRepository = require('../repositories/payment.repository');
const { emitToAccount } = require('../utils/socket');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');
const rules = require('../utils/membershipBenefits');

const { STATUS: USAGE_STATUS, SOURCE } = MembershipBenefitUsage;
const HELD_USAGE = [USAGE_STATUS.RESERVED, USAGE_STATUS.CONSUMED];

async function loadState(accountId, { now = new Date() } = {}) {
  if (!accountId) return null;
  const account = await Account.findOne({ id: Number(accountId) });
  if (!account) return null;

  const levels = await loyaltyService.getActiveLevels();
  const index = levels.findIndex((l) => l.code === account.membership_level);
  const level = index >= 0 ? levels[index] : null;
  const nextLevel = index >= 0 && index + 1 < levels.length ? levels[index + 1] : null;
  const levelBenefits = rules.normalizeBenefits(level ? level.benefits : null);

  const subscription = await membershipBenefitRepository.findLiveSubscription(account.id, now);
  const subscriptionBenefits = subscription ? rules.normalizeBenefits(subscription.plan.benefits) : null;

  const period = rules.periodKey(now);
  const tierCounter = levelBenefits.free_tickets > 0 ? await membershipBenefitRepository.findTierCounter(account.id, period) : null;
  const pools = rules.buildFreeTicketPools({
    subscription,
    subscriptionBenefits,
    tierBenefits: levelBenefits,
    tierUsed: tierCounter ? tierCounter.used : 0,
    period,
  });

  return {
    account,
    level,
    nextLevel,
    levelBenefits,
    subscription,
    subscriptionBenefits,
    period,
    pools,
    effective: rules.combineBenefits(levelBenefits, subscriptionBenefits),
  };
}

function presentLevel(level) {
  if (!level) return null;
  return { code: level.code, name: level.name, min_points: level.min_points, benefits: rules.normalizeBenefits(level.benefits) };
}

function presentSubscription(subscription) {
  if (!subscription) return null;
  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : { ...subscription };
  const limit = rules.normalizeBenefits(json.plan && json.plan.benefits).free_tickets;
  return {
    ...json,
    plan: json.plan ? { ...json.plan, benefits: rules.normalizeBenefits(json.plan.benefits) } : null,
    tickets_remaining: Math.max(limit - (json.tickets_used || 0), 0),
  };
}

// GET /api/membership/me — the caller's own membership and nothing else.
async function getMyMembership(accountId, { now = new Date() } = {}) {
  const state = await loadState(accountId, { now });
  if (!state) return null;
  const { account, level, nextLevel, subscription, pools, effective } = state;

  const pending = await Subscription.findOne({
    account_id: account.id,
    status: Subscription.STATUS.PENDING_PAYMENT,
    payment_expires_at: { $gt: now },
  });
  const tierPool = pools.find((p) => p.source === SOURCE.TIER) || null;
  const subscriptionPool = pools.find((p) => p.source === SOURCE.SUBSCRIPTION) || null;
  const pendingView = presentSubscription(pending);
  if (pendingView) {
    // The MoMo link, while it can still complete this purchase ("Continue payment").
    const payment = await paymentRepository.findByCode(pending.code);
    pendingView.pay_url = payment && payment.status === Payment.STATUS.PENDING ? payment.pay_url || null : null;
  }

  return {
    level: presentLevel(level) || { code: account.membership_level, name: account.membership_level, min_points: 0, benefits: rules.normalizeBenefits(null) },
    next_level: presentLevel(nextLevel),
    points_balance: account.points_balance,
    lifetime_points: account.lifetime_points,
    points_to_next_level: nextLevel ? Math.max(nextLevel.min_points - account.lifetime_points, 0) : 0,
    subscription: presentSubscription(subscription),
    pending_subscription: pendingView,
    effective_benefits: effective,
    free_tickets: {
      tier: tierPool ? { period: tierPool.period, limit: tierPool.limit, used: tierPool.used, remaining: tierPool.remaining } : null,
      subscription: subscriptionPool
        ? { limit: subscriptionPool.limit, used: subscriptionPool.used, remaining: subscriptionPool.remaining, ends_at: subscription.end_at }
        : null,
      remaining_total: pools.reduce((sum, p) => sum + p.remaining, 0),
    },
  };
}

function buildSnapshot(state, pricing) {
  if (!pricing || pricing.membershipDiscount <= 0) return null;
  return {
    level: state.account.membership_level,
    subscription_id: state.subscription ? state.subscription.id : null,
    free_tickets: pricing.freeTicketsApplied,
    free_ticket_amount: pricing.freeTicketAmount,
    ticket_discount_percent: pricing.ticketDiscount > 0 ? pricing.ticketDiscountPercent : 0,
    ticket_discount_amount: pricing.ticketDiscount,
    fnb_discount_percent: pricing.fnbDiscount > 0 ? pricing.fnbDiscountPercent : 0,
    fnb_discount_amount: pricing.fnbDiscount,
  };
}

// Applies the account's membership to an already-priced order (see computeMembershipPricing).
// Returns null for an unknown account (a guest), so callers price exactly as before.
async function priceMembership({ accountId, ticketRows, combos, freeTickets = 0, now = new Date() }) {
  const state = await loadState(accountId, { now });
  if (!state) return null;
  const pricing = rules.computeMembershipPricing({
    ticketRows,
    combos,
    effective: state.effective,
    pools: state.pools,
    freeTickets,
  });
  return { state, pricing, snapshot: buildSnapshot(state, pricing) };
}

function poolKey(allocation) {
  return allocation.source === SOURCE.SUBSCRIPTION ? `S:${allocation.subscription_id}` : `T:${allocation.period}`;
}

// The allowance a pool has: a subscription's own plan snapshot, or the tier the account holds now.
function poolLimit(sample, state) {
  if (sample.source === SOURCE.SUBSCRIPTION) {
    const subscription = state.subscription && state.subscription.id === sample.subscription_id ? state.subscription : null;
    return subscription ? rules.normalizeBenefits(subscription.plan.benefits).free_tickets : 0;
  }
  return state.levelBenefits ? state.levelBenefits.free_tickets : 0;
}

async function claimPool(sample, { accountId, count, limit, now }) {
  if (sample.source === SOURCE.SUBSCRIPTION) {
    return membershipBenefitRepository.claimSubscriptionTickets({
      subscriptionId: sample.subscription_id,
      accountId,
      count,
      limit,
      now,
    });
  }
  return membershipBenefitRepository.claimTierTickets({ accountId, period: sample.period, count, limit });
}

async function returnPool(sample, accountId, count) {
  if (sample.source === SOURCE.SUBSCRIPTION) return membershipBenefitRepository.returnSubscriptionTickets(sample.subscription_id, count);
  return membershipBenefitRepository.returnTierTickets(accountId, sample.period, count);
}

function announce(accountId, action) {
  emitToAccount(Number(accountId), REALTIME_EVENT.LOYALTY_UPDATED, { action });
}

// Checkout: takes the free tickets `allocations` (from priceMembership) for booking `bookingCode`.
// Each allowance is claimed with one conditional write that re-checks the term and the limit, so
// two checkouts can never spend the same last ticket; if any allowance falls short, what was already
// claimed is given back and nothing is recorded. Returns { ok } (ok:false => code).
async function reserveFreeTickets({ bookingCode, accountId, allocations, state, now = new Date() }) {
  if (!allocations || allocations.length === 0) return { ok: true, usages: [] };

  const groups = new Map();
  for (const allocation of allocations) {
    const key = poolKey(allocation);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(allocation);
  }

  const claimed = [];
  const rollback = async () => {
    for (const { sample, count } of claimed) await returnPool(sample, accountId, count);
  };
  for (const group of groups.values()) {
    const sample = group[0];
    const ok = await claimPool(sample, { accountId, count: group.length, limit: poolLimit(sample, state), now });
    if (!ok) {
      await rollback();
      return { ok: false, code: 'MEMBERSHIP_FREE_TICKETS_UNAVAILABLE' };
    }
    claimed.push({ sample, count: group.length });
  }

  try {
    const usages = await membershipBenefitRepository.createUsages(
      allocations.map((a) => ({
        account_id: Number(accountId),
        booking_code: String(bookingCode),
        ticket_id: Number(a.ticketId),
        source: a.source,
        subscription_id: a.subscription_id ?? null,
        period: a.period ?? null,
        amount: a.amount,
        status: USAGE_STATUS.RESERVED,
      })),
    );
    announce(accountId, 'FREE_TICKETS_RESERVED');
    return { ok: true, usages };
  } catch (err) {
    await rollback();
    throw err;
  }
}

// Gives back the free tickets a booking (or some of its seats) took. Idempotent: each usage is
// flipped to RELEASED at most once, and only that flip returns the ticket to its allowance.
async function releaseFreeTickets(bookingCode, { reason = null, ticketIds = null, now = new Date() } = {}) {
  if (!bookingCode) return 0;
  const filter = { status: { $in: HELD_USAGE } };
  if (Array.isArray(ticketIds)) filter.ticket_id = { $in: ticketIds.map(Number) };
  const usages = await membershipBenefitRepository.findUsagesByBooking(bookingCode, filter);

  let released = 0;
  for (const usage of usages) {
    const flipped = await membershipBenefitRepository.transitionUsage(usage.id, HELD_USAGE, {
      status: USAGE_STATUS.RELEASED,
      released_at: now,
      release_reason: reason,
    });
    if (!flipped) continue;
    await returnPool(flipped, flipped.account_id, 1);
    released += 1;
  }
  if (released > 0) announce(usages[0].account_id, 'FREE_TICKETS_RELEASED');
  return released;
}

// Payment confirmed: the booking's reserved free tickets become used. A usage that was released in
// the meantime (the booking's hold lapsed before the late payment arrived) is taken again — with the
// same conditional write as at checkout, so it is only honoured if the allowance still has it and
// the subscription is still live. If not, the whole booking's benefit is given back and { ok: false }
// is returned: the caller must not issue tickets priced with a benefit the customer no longer has.
async function consumeFreeTickets(bookingCode, { bookingId = null, now = new Date() } = {}) {
  const usages = await membershipBenefitRepository.findUsagesByBooking(bookingCode);
  if (usages.length === 0) return { ok: true, reinstated: 0 };

  await membershipBenefitRepository.markBookingUsagesConsumed(bookingCode, bookingId, now);

  const released = usages.filter((u) => u.status === USAGE_STATUS.RELEASED);
  if (released.length === 0) {
    if (bookingId) await membershipBenefitRepository.setUsagesBookingId(bookingCode, bookingId);
    return { ok: true, reinstated: 0 };
  }

  const state = await loadState(released[0].account_id, { now });
  let reinstated = 0;
  for (const usage of released) {
    // A subscription that is no longer live has a limit of 0 here, so nothing can be taken from it.
    const limit = state ? poolLimit(usage, state) : 0;
    const claimedBack = limit > 0 ? await claimPool(usage, { accountId: usage.account_id, count: 1, limit, now }) : null;
    const flipped = claimedBack
      ? await membershipBenefitRepository.transitionUsage(usage.id, [USAGE_STATUS.RELEASED], {
          status: USAGE_STATUS.CONSUMED,
          consumed_at: now,
          booking_id: bookingId,
          released_at: null,
          release_reason: null,
        })
      : null;
    if (!flipped) {
      if (claimedBack) await returnPool(usage, usage.account_id, 1);
      await releaseFreeTickets(bookingCode, { reason: 'BENEFIT_UNAVAILABLE', now });
      return { ok: false, code: 'MEMBERSHIP_BENEFIT_UNAVAILABLE' };
    }
    reinstated += 1;
  }
  if (bookingId) await membershipBenefitRepository.setUsagesBookingId(bookingCode, bookingId);
  return { ok: true, reinstated };
}

// Priority Booking: null when the caller may book this showtime now, else why not and from when.
async function checkSaleAccess({ schedule, accountId = null, now = new Date() }) {
  if (!schedule || !schedule.sale_opens_at) return null;
  const state = accountId ? await loadState(accountId, { now }) : null;
  const priorityHours = state ? state.effective.priority_booking_hours : 0;
  const window = rules.checkSaleWindow({ saleOpensAt: schedule.sale_opens_at, priorityHours, now });
  if (window.open) return null;
  return {
    status: 403,
    body: {
      message: 'Tickets for this showtime are not on sale yet',
      code: 'SALE_NOT_OPEN',
      opens_at: window.opensAt,
      general_opens_at: window.generalOpensAt,
    },
  };
}

// The seat page's view of the same rule (never refuses — it is only shown).
async function describeSaleAccess({ schedule, accountId = null, now = new Date() }) {
  if (!schedule || !schedule.sale_opens_at) return { open: true, opens_at: null, general_opens_at: null, priority: false };
  const state = accountId ? await loadState(accountId, { now }) : null;
  const priorityHours = state ? state.effective.priority_booking_hours : 0;
  const window = rules.checkSaleWindow({ saleOpensAt: schedule.sale_opens_at, priorityHours, now });
  return {
    open: window.open,
    priority: window.priority,
    opens_at: window.opensAt,
    general_opens_at: new Date(schedule.sale_opens_at),
    priority_booking_hours: priorityHours,
  };
}

module.exports = {
  loadState,
  getMyMembership,
  presentSubscription,
  priceMembership,
  reserveFreeTickets,
  releaseFreeTickets,
  consumeFreeTickets,
  checkSaleAccess,
  describeSaleAccess,
};
