// Shared world for the Ticket 53 (Membership & Subscription) suites: the group-booking world (branch
// 1, showtime 7 with A1..A10 = 100,000 and B1..B10 = 120,000, popcorn 50,000, drink 30,000; customers
// LAN, MINH, HOA) plus the default tier ladder and the Monthly Cinema Pass.
const Account = require('../src/models/Account');
const Counter = require('../src/models/Counter');
const MembershipLevel = require('../src/models/MembershipLevel');
const Subscription = require('../src/models/Subscription');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const { DEFAULT_LEVELS } = require('../src/services/loyaltyService');
const { ID, PRICE, auth, as, seatId, seatIds, range, seedGroupWorld } = require('./groupBookingFixtures');

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const PLAN = { MONTHLY: 1, RETIRED: 2 };
const MONTHLY_BENEFITS = { free_tickets: 4, fnb_discount_percent: 10 };

async function seedMembershipWorld(options = {}) {
  await seedGroupWorld(options);
  await MembershipLevel.create(DEFAULT_LEVELS.map((level, index) => ({ id: index + 1, ...level })));
  await SubscriptionPlan.create([
    {
      id: PLAN.MONTHLY,
      code: 'MONTHLY_PASS',
      name: 'Monthly Cinema Pass',
      price: 199000,
      duration_days: 30,
      benefits: MONTHLY_BENEFITS,
    },
    { id: PLAN.RETIRED, code: 'OLD_PASS', name: 'Old Pass', price: 99000, duration_days: 30, active: false },
  ]);
  // The rows above take explicit ids; the counters must start after them.
  await Counter.create([
    { name: 'subscriptionPlan', seq: PLAN.RETIRED },
    { name: 'membershipLevel', seq: DEFAULT_LEVELS.length },
  ]);
}

async function setTier(accountId, code) {
  await Account.updateOne({ id: accountId }, { $set: { membership_level: code } });
}

let subscriptionSeq = 900;
// An ACTIVE subscription that was paid for, without going through MoMo.
async function giveSubscription(
  accountId,
  { benefits = MONTHLY_BENEFITS, ticketsUsed = 0, startedMinutesAgo = 60, endsInMinutes = 30 * 24 * 60, status = 'ACTIVE' } = {},
) {
  subscriptionSeq += 1;
  const now = Date.now();
  return Subscription.create({
    id: subscriptionSeq,
    code: `SUB-T${subscriptionSeq}`,
    account_id: accountId,
    plan_id: PLAN.MONTHLY,
    plan: { code: 'MONTHLY_PASS', name: 'Monthly Cinema Pass', price: 199000, duration_days: 30, benefits },
    price: 199000,
    status,
    start_at: new Date(now - startedMinutesAgo * MINUTE),
    end_at: new Date(now + endsInMinutes * MINUTE),
    tickets_used: ticketsUsed,
    paid_at: new Date(now - startedMinutesAgo * MINUTE),
    ...(['ACTIVE', 'PENDING_PAYMENT'].includes(status) ? { open_key: String(accountId) } : {}),
  });
}

module.exports = {
  ID,
  PRICE,
  PLAN,
  MONTHLY_BENEFITS,
  DAY,
  MINUTE,
  auth,
  as,
  seatId,
  seatIds,
  range,
  seedMembershipWorld,
  setTier,
  giveSubscription,
};
