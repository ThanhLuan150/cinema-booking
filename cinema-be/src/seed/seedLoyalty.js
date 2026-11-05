const Account = require('../models/Account');
const MembershipLevel = require('../models/MembershipLevel');
const LoyaltyConfig = require('../models/LoyaltyConfig');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const nextId = require('../utils/nextId');
const { DEFAULT_LEVELS } = require('../services/loyaltyService');

// The example plan from Ticket 53. Created once; an admin edits or retires it from /MembershipAdmin.
const DEFAULT_PLANS = [
  {
    code: 'MONTHLY_PASS',
    name: 'Monthly Cinema Pass',
    description: '4 tickets every month and 10% off food & drinks.',
    price: 199000,
    duration_days: 30,
    benefits: { free_tickets: 4, fnb_discount_percent: 10 },
    sort_order: 1,
  },
];

async function seedLoyalty() {
  for (const level of DEFAULT_LEVELS) {
    if (!Account.MEMBERSHIP_LEVELS.includes(level.code)) continue;
    const exists = await MembershipLevel.findOne({ code: level.code });
    if (!exists) {
      const id = await nextId('membershipLevel');
      await MembershipLevel.create({ id, ...level });
      console.log(`Created membership level: ${level.code}`);
    } else {
      // Tiers created before Ticket 53 have no benefits block yet: give them the defaults, once.
      // A tier whose benefits an admin already set is never touched.
      const backfilled = await MembershipLevel.updateOne(
        { id: exists.id, benefits: { $exists: false } },
        { $set: { benefits: level.benefits } },
      );
      if (backfilled.modifiedCount > 0) console.log(`Added default benefits to membership level: ${level.code}`);
    }
  }

  for (const plan of DEFAULT_PLANS) {
    const exists = await SubscriptionPlan.findOne({ code: plan.code });
    if (!exists) {
      await SubscriptionPlan.create({ id: await nextId('subscriptionPlan'), ...plan });
      console.log(`Created subscription plan: ${plan.code}`);
    }
  }

  const existingConfig = await LoyaltyConfig.findOne({ id: LoyaltyConfig.SINGLETON_ID });
  if (!existingConfig) {
    await LoyaltyConfig.create({ id: LoyaltyConfig.SINGLETON_ID });
    console.log('Created default loyalty config');
  }

  console.log('Loyalty seed complete.');
}

module.exports = seedLoyalty;
module.exports.DEFAULT_PLANS = DEFAULT_PLANS;
