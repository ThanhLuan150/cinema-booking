const Account = require('../models/Account');
const MembershipLevel = require('../models/MembershipLevel');
const LoyaltyConfig = require('../models/LoyaltyConfig');
const PointsTransaction = require('../models/PointsTransaction');
const nextId = require('../utils/nextId');

const DEFAULT_CONFIG = {
  id: LoyaltyConfig.SINGLETON_ID,
  amount_per_point: 10000,
  points_expiry_days: 365,
  redeem_value_per_point: 100,
  min_redeem_points: 100,
};

const DEFAULT_LEVELS = [
  { code: 'NONE', name: 'Standard', min_points: 0 },
  { code: 'SILVER', name: 'Silver', min_points: 1000000 },
  { code: 'GOLD', name: 'Gold', min_points: 5000000 },
  { code: 'PLATINUM', name: 'Platinum', min_points: 15000000 },
];

async function getConfig() {
  const config = await LoyaltyConfig.findOne({ id: LoyaltyConfig.SINGLETON_ID });
  return config || new LoyaltyConfig(DEFAULT_CONFIG);
}

async function updateConfig(updates, updatedBy = null) {
  const existing = await LoyaltyConfig.findOne({ id: LoyaltyConfig.SINGLETON_ID });
  if (!existing) {
    return LoyaltyConfig.create({ ...DEFAULT_CONFIG, ...updates, updated_by: updatedBy });
  }
  Object.assign(existing, updates, { updated_by: updatedBy });
  await existing.save();
  return existing;
}

async function getActiveLevels() {
  const levels = await MembershipLevel.find({ active: true }).sort({ min_points: 1 });
  if (levels.length > 0) return levels;
  return DEFAULT_LEVELS.map((lvl, index) => new MembershipLevel({ id: -(index + 1), ...lvl }));
}

async function determineLevelForPoints(lifetimePoints) {
  const levels = await getActiveLevels();
  let best = null;
  for (const level of levels) {
    if (level.min_points <= lifetimePoints) best = level;
    else break; // levels are sorted ascending, nothing further can qualify
  }
  return best || levels[0] || null;
}

async function recalculateLevel(account) {
  const level = await determineLevelForPoints(account.lifetime_points);
  const previous = account.membership_level;
  if (level && level.code !== previous) {
    account.membership_level = level.code;
  }
  return { account, previous, current: account.membership_level, changed: previous !== account.membership_level };
}

async function getSummary(accountId) {
  const account = await Account.findOne({ id: Number(accountId) });
  if (!account) return null;

  const levels = await getActiveLevels();
  const currentIndex = levels.findIndex((l) => l.code === account.membership_level);
  const currentLevel = currentIndex >= 0 ? levels[currentIndex] : null;
  const nextLevel = currentIndex >= 0 && currentIndex + 1 < levels.length ? levels[currentIndex + 1] : null;

  return {
    membership_level: account.membership_level,
    membership_level_name: currentLevel ? currentLevel.name : account.membership_level,
    points_balance: account.points_balance,
    lifetime_points: account.lifetime_points,
    next_level: nextLevel ? { code: nextLevel.code, name: nextLevel.name, min_points: nextLevel.min_points } : null,
    points_to_next_level: nextLevel ? Math.max(nextLevel.min_points - account.lifetime_points, 0) : 0,
  };
}

async function listTransactions(accountId, { skip = 0, limit = 20 } = {}) {
  const filter = { account_id: Number(accountId) };
  const [data, total] = await Promise.all([
    PointsTransaction.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    PointsTransaction.countDocuments(filter),
  ]);
  return { data, total };
}

async function earnPointsForBooking({ accountId, bookingId, paymentId = null, amount, description = null }) {
  if (!accountId || !bookingId || !(Number(amount) > 0)) return null;

  const config = await getConfig();
  const points = Math.floor(Number(amount) / config.amount_per_point);
  if (points <= 0) return null;

  const expiresAt = config.points_expiry_days
    ? new Date(Date.now() + config.points_expiry_days * 24 * 60 * 60 * 1000)
    : null;

  let tx;
  try {
    tx = await PointsTransaction.create({
      id: await nextId('pointsTransaction'),
      account_id: Number(accountId),
      type: PointsTransaction.TYPE.EARN,
      points,
      remaining_points: points,
      booking_id: Number(bookingId),
      payment_id: paymentId ? Number(paymentId) : null,
      expires_at: expiresAt,
      description: description || `Earned from booking #${bookingId}`,
    });
  } catch (err) {
    if (err.code === 11000) return null; // already awarded for this booking
    throw err;
  }

  const account = await Account.findOneAndUpdate(
    { id: Number(accountId) },
    { $inc: { points_balance: points, lifetime_points: points } },
    { new: true },
  );
  if (account) {
    await recalculateLevel(account);
    await account.save();
    tx.balance_after = account.points_balance;
    await tx.save();
  }
  return tx;
}

async function reversePointsForBooking({ bookingId, reason = null }) {
  if (!bookingId) return null;

  const alreadyReversed = await PointsTransaction.findOne({
    booking_id: Number(bookingId),
    type: PointsTransaction.TYPE.REVERSAL,
  });
  if (alreadyReversed) return alreadyReversed;

  const earnTx = await PointsTransaction.findOne({ booking_id: Number(bookingId), type: PointsTransaction.TYPE.EARN });
  if (!earnTx) return null; // this booking never earned points (e.g. predates this feature)

  const reclaimable = earnTx.remaining_points;
  earnTx.remaining_points = 0;
  await earnTx.save();

  const account = await Account.findOne({ id: earnTx.account_id });
  let balanceAfter = null;
  if (account) {
    account.points_balance = Math.max(account.points_balance - reclaimable, 0);
    account.lifetime_points = Math.max(account.lifetime_points - earnTx.points, 0);
    await recalculateLevel(account);
    await account.save();
    balanceAfter = account.points_balance;
  }

  return PointsTransaction.create({
    id: await nextId('pointsTransaction'),
    account_id: earnTx.account_id,
    type: PointsTransaction.TYPE.REVERSAL,
    points: -reclaimable,
    remaining_points: 0,
    booking_id: Number(bookingId),
    balance_after: balanceAfter,
    description: reason || `Points reversed: booking #${bookingId} refunded`,
  });
}

async function redeemPoints({ accountId, points, description = null }) {
  const amount = Number(points);
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: 'INVALID_POINTS', message: 'points must be a positive integer' };
  }

  const config = await getConfig();
  if (amount < config.min_redeem_points) {
    return {
      error: 'BELOW_MIN_REDEEM',
      message: `A minimum of ${config.min_redeem_points} points is required to redeem`,
    };
  }

  const account = await Account.findOne({ id: Number(accountId) });
  if (!account) return { error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' };
  if (account.points_balance < amount) {
    return { error: 'INSUFFICIENT_POINTS', message: 'Not enough points balance' };
  }

  // FIFO: consume from the oldest still-usable EARN grants first.
  let remainingToConsume = amount;
  const earnTxs = await PointsTransaction.find({
    account_id: account.id,
    type: PointsTransaction.TYPE.EARN,
    remaining_points: { $gt: 0 },
    $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
  }).sort({ createdAt: 1 });

  for (const earnTx of earnTxs) {
    if (remainingToConsume <= 0) break;
    const take = Math.min(earnTx.remaining_points, remainingToConsume);
    earnTx.remaining_points -= take;
    remainingToConsume -= take;
    await earnTx.save();
  }

  account.points_balance -= amount;
  await account.save();

  const redeemValue = amount * config.redeem_value_per_point;
  const tx = await PointsTransaction.create({
    id: await nextId('pointsTransaction'),
    account_id: account.id,
    type: PointsTransaction.TYPE.REDEEM,
    points: -amount,
    remaining_points: 0,
    balance_after: account.points_balance,
    description: description || `Redeemed ${amount} points`,
  });

  return { transaction: tx, redeemValue };
}

async function expirePoints() {
  const now = new Date();
  const expiring = await PointsTransaction.find({
    type: PointsTransaction.TYPE.EARN,
    remaining_points: { $gt: 0 },
    expires_at: { $ne: null, $lt: now },
  });

  let count = 0;
  for (const earnTx of expiring) {
    const amount = earnTx.remaining_points;
    earnTx.remaining_points = 0;
    await earnTx.save();

    const account = await Account.findOneAndUpdate(
      { id: earnTx.account_id },
      { $inc: { points_balance: -amount } },
      { new: true },
    );

    await PointsTransaction.create({
      id: await nextId('pointsTransaction'),
      account_id: earnTx.account_id,
      type: PointsTransaction.TYPE.EXPIRE,
      points: -amount,
      remaining_points: 0,
      booking_id: earnTx.booking_id,
      balance_after: account ? account.points_balance : null,
      description: `${amount} points expired`,
    });
    count += 1;
  }
  return count;
}

async function adjustPoints({ accountId, amount, description = null, createdBy = null }) {
  const delta = Number(amount);
  if (!Number.isInteger(delta) || delta === 0) {
    return { error: 'INVALID_POINTS', message: 'amount must be a non-zero integer' };
  }

  const account = await Account.findOne({ id: Number(accountId) });
  if (!account) return { error: 'ACCOUNT_NOT_FOUND', message: 'Account not found' };
  if (delta < 0 && account.points_balance < -delta) {
    return { error: 'INSUFFICIENT_POINTS', message: 'Not enough points balance to deduct' };
  }

  account.points_balance += delta;
  if (delta > 0) account.lifetime_points += delta;
  await recalculateLevel(account);
  await account.save();

  const tx = await PointsTransaction.create({
    id: await nextId('pointsTransaction'),
    account_id: account.id,
    type: PointsTransaction.TYPE.ADJUST,
    points: delta,
    remaining_points: delta > 0 ? delta : 0,
    balance_after: account.points_balance,
    description: description || `Manual adjustment: ${delta > 0 ? '+' : ''}${delta} points`,
    created_by: createdBy,
  });
  return { transaction: tx };
}

module.exports = {
  getConfig,
  updateConfig,
  getActiveLevels,
  determineLevelForPoints,
  recalculateLevel,
  getSummary,
  listTransactions,
  earnPointsForBooking,
  reversePointsForBooking,
  redeemPoints,
  expirePoints,
  adjustPoints,
};
