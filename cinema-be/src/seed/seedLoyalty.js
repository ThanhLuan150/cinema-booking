const Account = require('../models/Account');
const MembershipLevel = require('../models/MembershipLevel');
const LoyaltyConfig = require('../models/LoyaltyConfig');
const nextId = require('../utils/nextId');

const DEFAULT_LEVELS = [
  { code: 'NONE', name: 'Standard', min_points: 0 },
  { code: 'SILVER', name: 'Silver', min_points: 1000000 },
  { code: 'GOLD', name: 'Gold', min_points: 5000000 },
  { code: 'PLATINUM', name: 'Platinum', min_points: 15000000 },
];

async function seedLoyalty() {
  for (const level of DEFAULT_LEVELS) {
    if (!Account.MEMBERSHIP_LEVELS.includes(level.code)) continue;
    const exists = await MembershipLevel.findOne({ code: level.code });
    if (!exists) {
      const id = await nextId('membershipLevel');
      await MembershipLevel.create({ id, ...level });
      console.log(`Created membership level: ${level.code}`);
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
