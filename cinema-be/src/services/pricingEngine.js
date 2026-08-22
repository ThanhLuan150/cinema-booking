const PricingRule = require('../models/PricingRule');
const Holiday = require('../models/Holiday');
const { priceForSeatType } = require('../utils/seatPricing');

async function resolveDayType({ dateStr, branchId }) {
  if (!dateStr) return 'WEEKDAY';

  const holiday = await Holiday.findOne({
    date: dateStr,
    $or: [{ branch_id: branchId ?? null }, { branch_id: null }],
  }).sort({ branch_id: -1 }); // branch-specific (non-null) sorts before global (null)
  if (holiday) return 'HOLIDAY';

  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY';
}

function matchesContext(rule, ctx) {
  if (rule.branch_id !== null && rule.branch_id !== ctx.branchId) return false;
  if (rule.room_type !== null && rule.room_type !== ctx.roomType) return false;
  if (rule.seat_type !== null && rule.seat_type !== ctx.seatType) return false;
  if (rule.category_id !== null && !(ctx.categoryIds || []).includes(rule.category_id)) return false;
  if (rule.day_type !== null && rule.day_type !== ctx.dayType) return false;
  if (rule.time_start !== null && rule.time_end !== null) {
    if (!ctx.timeBegin || ctx.timeBegin < rule.time_start || ctx.timeBegin > rule.time_end) return false;
  }
  if (rule.membership_level !== null && rule.membership_level !== (ctx.membershipLevel || 'NONE')) return false;
  return true;
}

function isEffective(rule, dateStr) {
  if (!dateStr) return true;
  if (rule.effective_from && dateStr < rule.effective_from) return false;
  if (rule.effective_to && dateStr > rule.effective_to) return false;
  return true;
}

function specificityOf(rule) {
  let score = 0;
  if (rule.branch_id !== null) score += 1;
  if (rule.room_type !== null) score += 1;
  if (rule.seat_type !== null) score += 1;
  if (rule.category_id !== null) score += 1;
  if (rule.day_type !== null) score += 1;
  if (rule.time_start !== null && rule.time_end !== null) score += 1;
  if (rule.membership_level !== null) score += 1;
  return score;
}

function compareRules(a, b) {
  if (b.priority !== a.priority) return b.priority - a.priority;
  const specDiff = specificityOf(b) - specificityOf(a);
  if (specDiff !== 0) return specDiff;
  return b.id - a.id;
}

async function findMatchingRules(ctx) {
  const query = {
    active: true,
    $or: [{ branch_id: null }, { branch_id: ctx.branchId ?? null }],
  };
  const rules = await PricingRule.find(query);
  const matching = rules.filter((rule) => isEffective(rule, ctx.date) && matchesContext(rule, ctx));
  matching.sort(compareRules);
  return matching;
}

async function findBestRule(ctx) {
  const matching = await findMatchingRules(ctx);
  return matching[0] || null;
}

async function calculateSeatPrice(ctx) {
  const dayType = ctx.dayType || (await resolveDayType({ dateStr: ctx.date, branchId: ctx.branchId }));
  const fullCtx = { ...ctx, dayType };
  const rule = await findBestRule(fullCtx);

  if (rule) {
    return { price: rule.price, source: 'RULE', ruleId: rule.id, ruleName: rule.name, dayType };
  }

  return { price: priceForSeatType(ctx.basePrice, ctx.seatType), source: 'DEFAULT', ruleId: null, ruleName: null, dayType };
}

module.exports = {
  resolveDayType,
  matchesContext,
  isEffective,
  specificityOf,
  compareRules,
  findMatchingRules,
  findBestRule,
  calculateSeatPrice,
};
