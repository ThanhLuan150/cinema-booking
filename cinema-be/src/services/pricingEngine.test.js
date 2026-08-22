const dbTestUtils = require('../../tests/dbTestUtils');
const PricingRule = require('../models/PricingRule');
const Holiday = require('../models/Holiday');
const {
  resolveDayType,
  matchesContext,
  isEffective,
  specificityOf,
  compareRules,
  findMatchingRules,
  findBestRule,
  calculateSeatPrice,
} = require('./pricingEngine');

beforeAll(async () => {
  await dbTestUtils.connect();
});

afterEach(async () => {
  await dbTestUtils.clearDatabase();
});

afterAll(async () => {
  await dbTestUtils.closeDatabase();
});

let nextRuleId = 1;
async function makeRule(overrides = {}) {
  return PricingRule.create({
    id: nextRuleId++,
    name: 'rule',
    price: 100000,
    priority: 0,
    active: true,
    effective_from: null,
    effective_to: null,
    branch_id: null,
    room_type: null,
    seat_type: null,
    category_id: null,
    day_type: null,
    time_start: null,
    time_end: null,
    membership_level: null,
    ...overrides,
  });
}

let nextHolidayId = 1;
async function makeHoliday(overrides = {}) {
  return Holiday.create({ id: nextHolidayId++, date: '2026-08-22', name: 'holiday', branch_id: null, ...overrides });
}

describe('resolveDayType', () => {
  it('resolves a known weekday to WEEKDAY', async () => {
    // 2026-08-24 is a Monday
    expect(await resolveDayType({ dateStr: '2026-08-24', branchId: 1 })).toBe('WEEKDAY');
  });

  it('resolves a Saturday/Sunday to WEEKEND', async () => {
    expect(await resolveDayType({ dateStr: '2026-08-22', branchId: 1 })).toBe('WEEKEND'); // Saturday
    expect(await resolveDayType({ dateStr: '2026-08-23', branchId: 1 })).toBe('WEEKEND'); // Sunday
  });

  it('a global Holiday overrides a weekday to HOLIDAY', async () => {
    await makeHoliday({ date: '2026-08-24', branch_id: null });
    expect(await resolveDayType({ dateStr: '2026-08-24', branchId: 1 })).toBe('HOLIDAY');
  });

  it('a branch-specific Holiday only applies to that branch', async () => {
    await makeHoliday({ date: '2026-08-24', branch_id: 1 });
    expect(await resolveDayType({ dateStr: '2026-08-24', branchId: 1 })).toBe('HOLIDAY');
    expect(await resolveDayType({ dateStr: '2026-08-24', branchId: 2 })).toBe('WEEKDAY');
  });

  it('a branch-specific Holiday takes precedence even when a global Holiday exists for the same date', async () => {
    // Regression: the DB query for a Holiday returns both rows; the query must prefer the
    // branch-specific one rather than whichever one Mongo happens to return first.
    await makeHoliday({ date: '2026-08-24', branch_id: null, name: 'Global' });
    await makeHoliday({ date: '2026-08-24', branch_id: 1, name: 'Branch' });
    expect(await resolveDayType({ dateStr: '2026-08-24', branchId: 1 })).toBe('HOLIDAY');
  });

  it('defaults to WEEKDAY when no date is given', async () => {
    expect(await resolveDayType({ dateStr: null, branchId: 1 })).toBe('WEEKDAY');
  });
});

describe('matchesContext', () => {
  const baseCtx = {
    branchId: 1,
    roomType: '2D',
    seatType: 0,
    categoryIds: [10, 20],
    dayType: 'WEEKDAY',
    timeBegin: '19:00',
    membershipLevel: 'GOLD',
  };

  it('a fully wildcard rule matches any context', () => {
    expect(matchesContext({ branch_id: null, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null }, baseCtx)).toBe(true);
  });

  it('rejects on a branch mismatch', () => {
    expect(matchesContext({ branch_id: 2, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null }, baseCtx)).toBe(false);
  });

  it('rejects on a room_type mismatch', () => {
    expect(matchesContext({ branch_id: null, room_type: 'IMAX', seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null }, baseCtx)).toBe(false);
  });

  it('matches seat_type 0 explicitly (falsy value must not be treated as wildcard)', () => {
    expect(matchesContext({ branch_id: null, room_type: null, seat_type: 0, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null }, baseCtx)).toBe(true);
    expect(matchesContext({ branch_id: null, room_type: null, seat_type: 1, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null }, baseCtx)).toBe(false);
  });

  it('matches category_id when it is among the movie categories', () => {
    expect(matchesContext({ branch_id: null, room_type: null, seat_type: null, category_id: 20, day_type: null, time_start: null, time_end: null, membership_level: null }, baseCtx)).toBe(true);
    expect(matchesContext({ branch_id: null, room_type: null, seat_type: null, category_id: 99, day_type: null, time_start: null, time_end: null, membership_level: null }, baseCtx)).toBe(false);
  });

  it('matches an inclusive showtime window', () => {
    const rule = { branch_id: null, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: '18:00', time_end: '23:00', membership_level: null };
    expect(matchesContext(rule, { ...baseCtx, timeBegin: '18:00' })).toBe(true); // lower bound
    expect(matchesContext(rule, { ...baseCtx, timeBegin: '23:00' })).toBe(true); // upper bound
    expect(matchesContext(rule, { ...baseCtx, timeBegin: '17:59' })).toBe(false);
    expect(matchesContext(rule, { ...baseCtx, timeBegin: '23:01' })).toBe(false);
  });

  it('rejects on a membership_level mismatch and defaults context to NONE when absent', () => {
    const rule = { branch_id: null, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: 'GOLD' };
    expect(matchesContext(rule, baseCtx)).toBe(true);
    expect(matchesContext(rule, { ...baseCtx, membershipLevel: undefined })).toBe(false);
    const noneRule = { ...rule, membership_level: 'NONE' };
    expect(matchesContext(noneRule, { ...baseCtx, membershipLevel: undefined })).toBe(true);
  });
});

describe('isEffective', () => {
  it('is effective with no bounds set', () => {
    expect(isEffective({ effective_from: null, effective_to: null }, '2026-08-22')).toBe(true);
  });

  it('respects an inclusive effective_from lower bound', () => {
    const rule = { effective_from: '2026-08-22', effective_to: null };
    expect(isEffective(rule, '2026-08-21')).toBe(false);
    expect(isEffective(rule, '2026-08-22')).toBe(true);
  });

  it('respects an inclusive effective_to upper bound', () => {
    const rule = { effective_from: null, effective_to: '2026-08-22' };
    expect(isEffective(rule, '2026-08-22')).toBe(true);
    expect(isEffective(rule, '2026-08-23')).toBe(false);
  });
});

describe('specificityOf', () => {
  it('scores a fully wildcard rule as 0', () => {
    expect(specificityOf({ branch_id: null, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null })).toBe(0);
  });

  it('scores each constrained dimension once', () => {
    expect(
      specificityOf({
        branch_id: 1,
        room_type: '2D',
        seat_type: 0,
        category_id: 10,
        day_type: 'WEEKEND',
        time_start: '18:00',
        time_end: '23:00',
        membership_level: 'GOLD',
      }),
    ).toBe(7);
  });

  it('counts a half-open time window (only one of time_start/time_end set) as unconstrained', () => {
    expect(specificityOf({ branch_id: null, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: '18:00', time_end: null, membership_level: null })).toBe(0);
  });
});

describe('compareRules (conflict resolution ordering)', () => {
  it('a higher priority always wins regardless of specificity', () => {
    const broad = { id: 1, priority: 10, branch_id: null, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null };
    const specific = { id: 2, priority: 1, branch_id: 1, room_type: '2D', seat_type: 0, category_id: 1, day_type: 'WEEKDAY', time_start: '18:00', time_end: '23:00', membership_level: 'GOLD' };
    expect(compareRules(broad, specific)).toBeLessThan(0); // broad sorts first
  });

  it('on a priority tie, the more specific rule wins', () => {
    const broad = { id: 1, priority: 5, branch_id: null, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null };
    const specific = { id: 2, priority: 5, branch_id: 1, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null };
    expect(compareRules(specific, broad)).toBeLessThan(0);
  });

  it('on a full tie, the most recently created rule (highest id) wins', () => {
    const older = { id: 1, priority: 5, branch_id: 1, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null };
    const newer = { id: 2, priority: 5, branch_id: 1, room_type: null, seat_type: null, category_id: null, day_type: null, time_start: null, time_end: null, membership_level: null };
    expect(compareRules(newer, older)).toBeLessThan(0);
  });
});

describe('findMatchingRules / findBestRule (integration, with real documents)', () => {
  const ctx = {
    branchId: 1,
    roomType: '2D',
    seatType: 0,
    categoryIds: [],
    dayType: 'WEEKDAY',
    date: '2026-08-24',
    timeBegin: '19:00',
    membershipLevel: 'NONE',
  };

  it('returns null when no rule matches', async () => {
    await makeRule({ branch_id: 2 }); // different branch
    expect(await findBestRule(ctx)).toBeNull();
  });

  it('ignores inactive rules', async () => {
    await makeRule({ active: false, price: 999999 });
    expect(await findBestRule(ctx)).toBeNull();
  });

  it('ignores rules outside their effective date range', async () => {
    await makeRule({ effective_from: '2026-09-01', price: 999999 });
    await makeRule({ effective_to: '2026-08-01', price: 999999 });
    expect(await findBestRule(ctx)).toBeNull();
  });

  it('picks the single matching rule', async () => {
    const rule = await makeRule({ branch_id: 1, room_type: '2D', price: 80000 });
    const best = await findBestRule(ctx);
    expect(best.id).toBe(rule.id);
    expect(best.price).toBe(80000);
  });

  it('resolves the documented example: 2D+STANDARD+WEEKDAY vs 2D+VIP+WEEKDAY vs IMAX+VIP+WEEKEND', async () => {
    await makeRule({ name: '2D+STANDARD+WEEKDAY', room_type: '2D', seat_type: 0, day_type: 'WEEKDAY', price: 80000 });
    await makeRule({ name: '2D+VIP+WEEKDAY', room_type: '2D', seat_type: 1, day_type: 'WEEKDAY', price: 120000 });
    await makeRule({ name: 'IMAX+VIP+WEEKEND', room_type: 'IMAX', seat_type: 1, day_type: 'WEEKEND', price: 200000 });

    expect((await findBestRule({ ...ctx, roomType: '2D', seatType: 0, dayType: 'WEEKDAY' })).price).toBe(80000);
    expect((await findBestRule({ ...ctx, roomType: '2D', seatType: 1, dayType: 'WEEKDAY' })).price).toBe(120000);
    expect((await findBestRule({ ...ctx, roomType: 'IMAX', seatType: 1, dayType: 'WEEKEND' })).price).toBe(200000);
  });

  it('conflict: a higher-priority broad rule beats a lower-priority specific rule', async () => {
    await makeRule({ name: 'specific', room_type: '2D', seat_type: 0, priority: 1, price: 80000 });
    await makeRule({ name: 'broad-but-important', priority: 100, price: 50000 }); // e.g. a storewide promo
    const best = await findBestRule(ctx);
    expect(best.price).toBe(50000);
    expect(best.name).toBe('broad-but-important');
  });

  it('conflict: same priority, the more specific rule wins', async () => {
    await makeRule({ name: 'branch-only', branch_id: 1, priority: 5, price: 90000 });
    await makeRule({ name: 'branch+room', branch_id: 1, room_type: '2D', priority: 5, price: 85000 });
    const best = await findBestRule(ctx);
    expect(best.name).toBe('branch+room');
    expect(best.price).toBe(85000);
  });

  it('a branch-scoped rule does not leak into another branch', async () => {
    await makeRule({ branch_id: 2, price: 999999 });
    const global = await makeRule({ branch_id: null, price: 70000 });
    const best = await findBestRule(ctx);
    expect(best.id).toBe(global.id);
  });

  it('findMatchingRules returns every match sorted best-first', async () => {
    await makeRule({ priority: 1, price: 1 });
    await makeRule({ priority: 5, price: 2 });
    await makeRule({ priority: 3, price: 3 });
    const matches = await findMatchingRules(ctx);
    expect(matches.map((r) => r.priority)).toEqual([5, 3, 1]);
  });
});

describe('calculateSeatPrice', () => {
  const baseCtx = {
    branchId: 1,
    roomType: '2D',
    seatType: 1, // vip
    categoryIds: [],
    date: '2026-08-24', // Monday -> WEEKDAY
    timeBegin: '19:00',
    membershipLevel: 'NONE',
    basePrice: 100000,
  };

  it('falls back to the base price + seat-type multiplier when no rule matches', async () => {
    const result = await calculateSeatPrice(baseCtx);
    expect(result).toEqual({ price: 120000, source: 'DEFAULT', ruleId: null, ruleName: null, dayType: 'WEEKDAY' });
  });

  it('uses the winning rule price when a rule matches', async () => {
    const rule = await makeRule({ room_type: '2D', seat_type: 1, day_type: 'WEEKDAY', price: 120000, name: 'match' });
    const result = await calculateSeatPrice(baseCtx);
    expect(result.source).toBe('RULE');
    expect(result.ruleId).toBe(rule.id);
    expect(result.price).toBe(120000);
  });

  it('resolves dayType from a Holiday even when the date falls on a weekday', async () => {
    await makeHoliday({ date: '2026-08-24', branch_id: null });
    await makeRule({ day_type: 'HOLIDAY', price: 250000 });
    const result = await calculateSeatPrice(baseCtx);
    expect(result.dayType).toBe('HOLIDAY');
    expect(result.price).toBe(250000);
  });

  it('accepts a precomputed dayType instead of resolving it again', async () => {
    await makeRule({ day_type: 'HOLIDAY', price: 250000 });
    const result = await calculateSeatPrice({ ...baseCtx, dayType: 'HOLIDAY' });
    expect(result.price).toBe(250000);
  });
});
