const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const loyaltyService = require('./loyaltyService');
const Account = require('../models/Account');
const MembershipLevel = require('../models/MembershipLevel');
const LoyaltyConfig = require('../models/LoyaltyConfig');
const PointsTransaction = require('../models/PointsTransaction');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedLevels() {
  await MembershipLevel.create([
    { id: 1, code: 'NONE', name: 'Standard', min_points: 0 },
    { id: 2, code: 'SILVER', name: 'Silver', min_points: 100 },
    { id: 3, code: 'GOLD', name: 'Gold', min_points: 500 },
    { id: 4, code: 'PLATINUM', name: 'Platinum', min_points: 1000 },
  ]);
}

describe('loyaltyService.getConfig / updateConfig', () => {
  it('returns an unsaved default config when none exists yet', async () => {
    const config = await loyaltyService.getConfig();
    expect(config.amount_per_point).toBe(10000);
    expect(await LoyaltyConfig.countDocuments()).toBe(0); // never persisted just by reading
  });

  it('updateConfig creates the singleton on first write and applies overrides', async () => {
    const updated = await loyaltyService.updateConfig({ amount_per_point: 5000 }, 99);
    expect(updated.amount_per_point).toBe(5000);
    expect(updated.updated_by).toBe(99);
    expect(await LoyaltyConfig.countDocuments()).toBe(1);
  });

  it('updateConfig on a second call updates the existing singleton in place', async () => {
    await loyaltyService.updateConfig({ amount_per_point: 5000 });
    await loyaltyService.updateConfig({ min_redeem_points: 50 });
    expect(await LoyaltyConfig.countDocuments()).toBe(1);
    const config = await loyaltyService.getConfig();
    expect(config.amount_per_point).toBe(5000);
    expect(config.min_redeem_points).toBe(50);
  });
});

describe('loyaltyService.getActiveLevels / determineLevelForPoints', () => {
  it('falls back to in-memory defaults when nothing is seeded', async () => {
    const levels = await loyaltyService.getActiveLevels();
    expect(levels.map((l) => l.code)).toEqual(['NONE', 'SILVER', 'GOLD', 'PLATINUM']);
    expect(await MembershipLevel.countDocuments()).toBe(0);
  });

  it('excludes inactive levels', async () => {
    await seedLevels();
    await MembershipLevel.updateOne({ code: 'GOLD' }, { $set: { active: false } });
    const levels = await loyaltyService.getActiveLevels();
    expect(levels.map((l) => l.code)).toEqual(['NONE', 'SILVER', 'PLATINUM']);
  });

  it('determineLevelForPoints picks the highest tier the points qualify for', async () => {
    await seedLevels();
    expect((await loyaltyService.determineLevelForPoints(0)).code).toBe('NONE');
    expect((await loyaltyService.determineLevelForPoints(99)).code).toBe('NONE');
    expect((await loyaltyService.determineLevelForPoints(100)).code).toBe('SILVER');
    expect((await loyaltyService.determineLevelForPoints(999)).code).toBe('GOLD');
    expect((await loyaltyService.determineLevelForPoints(1000)).code).toBe('PLATINUM');
    expect((await loyaltyService.determineLevelForPoints(999999)).code).toBe('PLATINUM');
  });
});

describe('loyaltyService.recalculateLevel', () => {
  it('upgrades an account whose lifetime_points now qualify for a higher tier', async () => {
    await seedLevels();
    const account = new Account({ id: 1, email: 'a@b.com', password: 'x', lifetime_points: 500, membership_level: 'NONE' });
    const result = await loyaltyService.recalculateLevel(account);
    expect(result.changed).toBe(true);
    expect(result.previous).toBe('NONE');
    expect(result.current).toBe('GOLD');
    expect(account.membership_level).toBe('GOLD');
  });

  it('is a no-op when the account is already at the correct tier', async () => {
    await seedLevels();
    const account = new Account({ id: 1, email: 'a@b.com', password: 'x', lifetime_points: 200, membership_level: 'SILVER' });
    const result = await loyaltyService.recalculateLevel(account);
    expect(result.changed).toBe(false);
    expect(account.membership_level).toBe('SILVER');
  });

  it('downgrades an account after a reversal drops it below its current tier threshold', async () => {
    await seedLevels();
    const account = new Account({ id: 1, email: 'a@b.com', password: 'x', lifetime_points: 50, membership_level: 'GOLD' });
    const result = await loyaltyService.recalculateLevel(account);
    expect(result.current).toBe('NONE');
  });
});

describe('loyaltyService.earnPointsForBooking', () => {
  it('credits points floored to the configured amount_per_point and updates the account', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const tx = await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 100, amount: 105000 });
    expect(tx.points).toBe(10); // floor(105000 / 10000)
    expect(tx.remaining_points).toBe(10);
    expect(tx.type).toBe('EARN');
    expect(tx.expires_at).toBeInstanceOf(Date);

    const account = await Account.findOne({ id: 1 });
    expect(account.points_balance).toBe(10);
    expect(account.lifetime_points).toBe(10);
  });

  it('returns null and awards nothing when the amount rounds down to 0 points', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const tx = await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 100, amount: 500 });
    expect(tx).toBeNull();
    expect((await Account.findOne({ id: 1 })).points_balance).toBe(0);
  });

  it('never double-credits the same booking, even with a manually forced duplicate transaction', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 100, amount: 100000 });
    const second = await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 100, amount: 100000 });
    expect(second).toBeNull();

    const account = await Account.findOne({ id: 1 });
    expect(account.points_balance).toBe(10);
    expect(await PointsTransaction.countDocuments({ booking_id: 100, type: 'EARN' })).toBe(1);
  });

  it('recalculates the account\'s membership tier after earning', async () => {
    await seedLevels();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 100, amount: 1000000 }); // 100 points
    expect((await Account.findOne({ id: 1 })).membership_level).toBe('SILVER');
  });
});

describe('loyaltyService.reversePointsForBooking', () => {
  it('claws back the full grant when none of it has been spent, and downgrades the tier', async () => {
    await seedLevels();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 100, amount: 1000000 }); // 100 points -> SILVER

    const reversal = await loyaltyService.reversePointsForBooking({ bookingId: 100 });
    expect(reversal.points).toBe(-100);

    const account = await Account.findOne({ id: 1 });
    expect(account.points_balance).toBe(0);
    expect(account.lifetime_points).toBe(0);
    expect(account.membership_level).toBe('NONE');
  });

  it('only claws back what is left unredeemed when some of the grant was already spent', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 100, amount: 2000000 }); // 200 points
    await loyaltyService.redeemPoints({ accountId: 1, points: 150 }); // >= default min_redeem_points (100)

    const reversal = await loyaltyService.reversePointsForBooking({ bookingId: 100 });
    expect(reversal.points).toBe(-50); // only the unredeemed remainder is clawed back from balance

    const account = await Account.findOne({ id: 1 });
    expect(account.points_balance).toBe(0); // 200 - 150 redeemed - 50 reversed
    expect(account.lifetime_points).toBe(0); // the full original grant no longer counts toward tier
  });

  it('is idempotent: a second reversal call for the same booking is a no-op', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 100, amount: 1000000 });
    const first = await loyaltyService.reversePointsForBooking({ bookingId: 100 });
    const second = await loyaltyService.reversePointsForBooking({ bookingId: 100 });
    expect(second.id).toBe(first.id);
    expect(await PointsTransaction.countDocuments({ booking_id: 100, type: 'REVERSAL' })).toBe(1);
  });

  it('returns null when the booking never earned any points', async () => {
    const result = await loyaltyService.reversePointsForBooking({ bookingId: 999 });
    expect(result).toBeNull();
  });
});

describe('loyaltyService.redeemPoints', () => {
  it('rejects a redemption below the configured minimum', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 500 });
    const result = await loyaltyService.redeemPoints({ accountId: 1, points: 10 });
    expect(result.error).toBe('BELOW_MIN_REDEEM');
  });

  it('rejects a redemption exceeding the balance', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 100 });
    const result = await loyaltyService.redeemPoints({ accountId: 1, points: 200 });
    expect(result.error).toBe('INSUFFICIENT_POINTS');
  });

  it('rejects a non-integer or non-positive amount', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 500 });
    expect((await loyaltyService.redeemPoints({ accountId: 1, points: 100.5 })).error).toBe('INVALID_POINTS');
    expect((await loyaltyService.redeemPoints({ accountId: 1, points: -100 })).error).toBe('INVALID_POINTS');
  });

  it('deducts the balance and records a REDEEM transaction with the configured redeem value', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 500 });
    await loyaltyService.earnPointsForBooking; // no-op reference to avoid unused import warnings in some setups
    const result = await loyaltyService.redeemPoints({ accountId: 1, points: 200 });
    expect(result.transaction.points).toBe(-200);
    expect(result.redeemValue).toBe(200 * 100); // default redeem_value_per_point

    const account = await Account.findOne({ id: 1 });
    expect(account.points_balance).toBe(300);
  });

  it('consumes the oldest earn grants first (FIFO)', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 1, amount: 600000 }); // 60 pts, oldest
    await loyaltyService.earnPointsForBooking({ accountId: 1, bookingId: 2, amount: 800000 }); // 80 pts, newest

    await loyaltyService.redeemPoints({ accountId: 1, points: 100 });

    const [oldest, newest] = await Promise.all([
      PointsTransaction.findOne({ booking_id: 1, type: 'EARN' }),
      PointsTransaction.findOne({ booking_id: 2, type: 'EARN' }),
    ]);
    expect(oldest.remaining_points).toBe(0); // fully consumed first
    expect(newest.remaining_points).toBe(40); // 80 - (100 - 60)
  });

  it('does not consume from an already-expired grant', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 100 });
    await PointsTransaction.create({
      id: 9001, account_id: 1, type: 'EARN', points: 100, remaining_points: 100, booking_id: 500,
      expires_at: new Date(Date.now() - 1000), // already expired
    });
    const result = await loyaltyService.redeemPoints({ accountId: 1, points: 100 });
    expect(result.transaction).toBeDefined(); // balance-authoritative deduction still succeeds
    const earnTx = await PointsTransaction.findOne({ id: 9001 });
    expect(earnTx.remaining_points).toBe(100); // but the expired grant itself is left untouched
  });
});

describe('loyaltyService.expirePoints', () => {
  it('zeroes out remaining_points on a past-due grant, deducts the balance, and logs an EXPIRE row', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 50, lifetime_points: 50 });
    await PointsTransaction.create({
      id: 9001, account_id: 1, type: 'EARN', points: 50, remaining_points: 50, booking_id: 500,
      expires_at: new Date(Date.now() - 1000),
    });

    const count = await loyaltyService.expirePoints();
    expect(count).toBe(1);

    const account = await Account.findOne({ id: 1 });
    expect(account.points_balance).toBe(0);
    expect(account.lifetime_points).toBe(50); // expiry never affects tier-qualifying lifetime points

    const earnTx = await PointsTransaction.findOne({ id: 9001 });
    expect(earnTx.remaining_points).toBe(0);
    const expireTx = await PointsTransaction.findOne({ account_id: 1, type: 'EXPIRE' });
    expect(expireTx.points).toBe(-50);
  });

  it('ignores grants that are not yet expired or already fully consumed', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await PointsTransaction.create([
      { id: 9001, account_id: 1, type: 'EARN', points: 10, remaining_points: 10, booking_id: 501, expires_at: new Date(Date.now() + 100000) },
      { id: 9002, account_id: 1, type: 'EARN', points: 10, remaining_points: 0, booking_id: 502, expires_at: new Date(Date.now() - 1000) },
      { id: 9003, account_id: 1, type: 'EARN', points: 10, remaining_points: 10, booking_id: 503, expires_at: null },
    ]);
    expect(await loyaltyService.expirePoints()).toBe(0);
  });
});

describe('loyaltyService.adjustPoints', () => {
  it('credits a positive manual adjustment and counts it toward lifetime_points', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const result = await loyaltyService.adjustPoints({ accountId: 1, amount: 50, createdBy: 9 });
    expect(result.transaction.points).toBe(50);
    const account = await Account.findOne({ id: 1 });
    expect(account.points_balance).toBe(50);
    expect(account.lifetime_points).toBe(50);
  });

  it('rejects a negative adjustment larger than the current balance', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 10 });
    const result = await loyaltyService.adjustPoints({ accountId: 1, amount: -20 });
    expect(result.error).toBe('INSUFFICIENT_POINTS');
  });

  it('a negative adjustment does not reduce lifetime_points (tier is not revoked by a manual debit)', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', points_balance: 50, lifetime_points: 50 });
    await loyaltyService.adjustPoints({ accountId: 1, amount: -20 });
    const account = await Account.findOne({ id: 1 });
    expect(account.points_balance).toBe(30);
    expect(account.lifetime_points).toBe(50);
  });
});

describe('loyaltyService.getSummary / listTransactions', () => {
  it('getSummary reports the current tier, balance, and progress to the next tier', async () => {
    await seedLevels();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', membership_level: 'SILVER', points_balance: 40, lifetime_points: 200 });
    const summary = await loyaltyService.getSummary(1);
    expect(summary.membership_level).toBe('SILVER');
    expect(summary.membership_level_name).toBe('Silver');
    expect(summary.next_level).toEqual({ code: 'GOLD', name: 'Gold', min_points: 500 });
    expect(summary.points_to_next_level).toBe(300);
  });

  it('getSummary returns null next_level for the top tier', async () => {
    await seedLevels();
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', membership_level: 'PLATINUM', lifetime_points: 5000 });
    const summary = await loyaltyService.getSummary(1);
    expect(summary.next_level).toBeNull();
    expect(summary.points_to_next_level).toBe(0);
  });

  it('getSummary returns null for a missing account', async () => {
    expect(await loyaltyService.getSummary(999)).toBeNull();
  });

  it('listTransactions paginates newest-first', async () => {
    await PointsTransaction.create([
      { id: 1, account_id: 1, type: 'ADJUST', points: 1 },
      { id: 2, account_id: 1, type: 'ADJUST', points: 2 },
      { id: 3, account_id: 1, type: 'ADJUST', points: 3 },
    ]);
    const page = await loyaltyService.listTransactions(1, { skip: 0, limit: 2 });
    expect(page.total).toBe(3);
    expect(page.data.map((t) => t.id)).toEqual([3, 2]);
  });
});
