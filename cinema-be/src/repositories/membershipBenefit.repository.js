const Subscription = require('../models/Subscription');
const TierBenefitCounter = require('../models/TierBenefitCounter');
const MembershipBenefitUsage = require('../models/MembershipBenefitUsage');
const nextId = require('../utils/nextId');

const { STATUS: USAGE_STATUS } = MembershipBenefitUsage;

// The subscription that gives benefits right now: ACTIVE and inside its term. Never trusts status
// alone — an ACTIVE row whose end_at has passed (the sweep has not run yet) does not count.
async function findLiveSubscription(accountId, now = new Date()) {
  return Subscription.findOne({
    account_id: Number(accountId),
    status: Subscription.STATUS.ACTIVE,
    start_at: { $lte: now },
    end_at: { $gt: now },
  });
}

async function findTierCounter(accountId, period) {
  return TierBenefitCounter.findOne({ account_id: Number(accountId), period });
}

// Takes `count` free tickets of a subscription's term in ONE conditional write that re-checks
// everything the benefit depends on: still ACTIVE, still inside its term, and enough left. Two
// checkouts racing for the last ticket cannot both match. `limit` is the subscription's own
// (immutable) plan snapshot. Returns the updated subscription, or null when it no longer qualifies.
async function claimSubscriptionTickets({ subscriptionId, accountId, count, limit, now = new Date() }) {
  if (!(count > 0) || count > limit) return null;
  return Subscription.findOneAndUpdate(
    {
      id: Number(subscriptionId),
      account_id: Number(accountId),
      status: Subscription.STATUS.ACTIVE,
      start_at: { $lte: now },
      end_at: { $gt: now },
      tickets_used: { $lte: limit - count },
    },
    { $inc: { tickets_used: count } },
    { new: true },
  );
}

async function returnSubscriptionTickets(subscriptionId, count = 1) {
  return Subscription.findOneAndUpdate(
    { id: Number(subscriptionId), tickets_used: { $gte: count } },
    { $inc: { tickets_used: -count } },
    { new: true },
  );
}

// Same for a tier's monthly allowance. The counter row is created on first use (upsert); when a row
// exists but has too few left, the upsert's insert collides with the unique (account, period) index,
// which is answered as "not enough left" too.
async function claimTierTickets({ accountId, period, count, limit }) {
  if (!(count > 0) || count > limit) return null;
  try {
    return await TierBenefitCounter.findOneAndUpdate(
      { account_id: Number(accountId), period, used: { $lte: limit - count } },
      { $inc: { used: count } },
      { new: true, upsert: true },
    );
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

async function returnTierTickets(accountId, period, count = 1) {
  return TierBenefitCounter.findOneAndUpdate(
    { account_id: Number(accountId), period, used: { $gte: count } },
    { $inc: { used: -count } },
    { new: true },
  );
}

async function createUsages(rows) {
  const docs = [];
  for (const row of rows) docs.push({ id: await nextId('membershipBenefitUsage'), ...row });
  return MembershipBenefitUsage.insertMany(docs);
}

async function findUsagesByBooking(bookingCode, filter = {}) {
  return MembershipBenefitUsage.find({ booking_code: String(bookingCode), ...filter }).sort({ id: 1 });
}

// The once-only gate of every usage transition: only the caller whose flip matched may move the
// counter, so a release that runs twice (IPN + browser, cancel + sweep) gives a ticket back once.
async function transitionUsage(id, fromStatuses, set) {
  return MembershipBenefitUsage.findOneAndUpdate(
    { id: Number(id), status: { $in: fromStatuses } },
    { $set: set },
    { new: true },
  );
}

async function markBookingUsagesConsumed(bookingCode, bookingId, now = new Date()) {
  return MembershipBenefitUsage.updateMany(
    { booking_code: String(bookingCode), status: USAGE_STATUS.RESERVED },
    { $set: { status: USAGE_STATUS.CONSUMED, consumed_at: now, booking_id: bookingId ?? null } },
  );
}

async function setUsagesBookingId(bookingCode, bookingId) {
  return MembershipBenefitUsage.updateMany({ booking_code: String(bookingCode) }, { $set: { booking_id: bookingId } });
}

module.exports = {
  findLiveSubscription,
  findTierCounter,
  claimSubscriptionTickets,
  returnSubscriptionTickets,
  claimTierTickets,
  returnTierTickets,
  createUsages,
  findUsagesByBooking,
  transitionUsage,
  markBookingUsagesConsumed,
  setUsagesBookingId,
};
