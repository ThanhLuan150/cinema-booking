const Account = require('../models/Account');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const ComboOrder = require('../models/ComboOrder');
const Refund = require('../models/Refund');
const Schedule = require('../models/Schedule');
const Branch = require('../models/Branch');
const MovieCategory = require('../models/MovieCategory');
const Category = require('../models/Category');
const bookingRepository = require('../repositories/booking.repository');
const loyaltyService = require('./loyaltyService');

const PAID_COMBO_STATUSES = [
  ComboOrder.STATUS.PAID,
  ComboOrder.STATUS.PREPARING,
  ComboOrder.STATUS.READY,
  ComboOrder.STATUS.DELIVERED,
];
const SOLD_BOOKING_STATUSES = [Booking.STATUS.PAID, Booking.STATUS.COMPLETED];
const FAVORITE_GENRE_LIMIT = 3;

const STAFF_REDACTED_FIELDS = ['favorite_genres', 'total_combo_spending', 'lifetime_points'];

class CrmAccessError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'CrmAccessError';
  }
}

function parseAccountId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new CrmAccessError('Invalid customer id');
  return n;
}

function branchIn(field, branchIds) {
  if (branchIds == null) return {};
  return { [field]: { $in: branchIds.map(Number) } };
}

function num(value) {
  return Number(value) || 0;
}

// Decides which branches a staff caller's CRM view may draw on. Mirrors
// reporting.service.resolveReportScope: ALL -> null (unrestricted), BRANCH -> the caller's
// own accessible branches, anything else -> refuse.
async function resolveCrmScope(req) {
  if (req.permissionScope === 'ALL') return { branchIds: null };

  if (req.permissionScope === 'BRANCH') {
    const accessible = await bookingRepository.resolveAccessibleBranchIds(req.account.accountId);
    if (accessible.length === 0) throw new CrmAccessError('No accessible branch');
    return { branchIds: accessible };
  }

  throw new CrmAccessError('Forbidden');
}

function computeFavoriteBranch(bookings, nameById) {
  const counts = new Map();
  for (const b of bookings) counts.set(b.branch_id, (counts.get(b.branch_id) || 0) + 1);
  let best = null;
  for (const [branchId, count] of counts) {
    if (!best || count > best.count) best = { branch_id: branchId, count };
  }
  if (!best) return null;
  return { branch_id: best.branch_id, name: nameById.get(best.branch_id) || `#${best.branch_id}`, bookings: best.count };
}

async function computeFavoriteGenres(bookings) {
  if (bookings.length === 0) return [];

  const scheduleIds = [...new Set(bookings.map((b) => b.schedule_id))];
  const schedules = await Schedule.find({ id: { $in: scheduleIds } }, { id: 1, movie_id: 1 });
  const movieIdByScheduleId = new Map(schedules.map((s) => [s.id, s.movie_id]));

  const movieIds = [...new Set([...movieIdByScheduleId.values()])];
  const links = await MovieCategory.find({ movie_id: { $in: movieIds } }, { movie_id: 1, cat_id: 1 });
  const catIdsByMovieId = new Map();
  for (const link of links) {
    if (!catIdsByMovieId.has(link.movie_id)) catIdsByMovieId.set(link.movie_id, []);
    catIdsByMovieId.get(link.movie_id).push(link.cat_id);
  }

  // One "vote" per booking for each genre the booked movie belongs to.
  const votes = new Map();
  for (const b of bookings) {
    const movieId = movieIdByScheduleId.get(b.schedule_id);
    for (const catId of catIdsByMovieId.get(movieId) || []) {
      votes.set(catId, (votes.get(catId) || 0) + 1);
    }
  }
  if (votes.size === 0) return [];

  const categories = await Category.find({ id: { $in: [...votes.keys()] } }, { id: 1, name: 1 });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return [...votes.entries()]
    .map(([catId, count]) => ({ id: catId, name: nameById.get(catId) || `#${catId}`, bookings: count }))
    .sort((a, b) => b.bookings - a.bookings || a.name.localeCompare(b.name))
    .slice(0, FAVORITE_GENRE_LIMIT);
}

// Actual physical visit = a ticket that was scanned at the door. Falls back to the most
// recent payment date when the customer has bought but never (yet) checked in.
function computeLastVisit(invoices, bookings) {
  const checkIns = invoices.map((i) => i.checked_in_at).filter(Boolean);
  if (checkIns.length > 0) return new Date(Math.max(...checkIns.map((d) => new Date(d).getTime())));

  const paidAts = bookings.map((b) => b.paid_at || b.createdAt).filter(Boolean);
  if (paidAts.length > 0) return new Date(Math.max(...paidAts.map((d) => new Date(d).getTime())));
  return null;
}

/**
 * @param {object} opts
 * @param {number} opts.accountId  the customer whose profile to build
 * @param {number[]|null} [opts.branchIds]  branch scope; null/undefined = unrestricted
 * @param {boolean} [opts.redact]  drop marketing-analytics fields (EMPLOYEE callers)
 * @returns {Promise<object|null>}  null when no such account exists
 */
async function buildCustomerProfile({ accountId, branchIds = null, redact = false } = {}) {
  const id = Number(accountId);
  const account = await Account.findOne({ id });
  if (!account) return null;

  // Base set: the customer's PAID payments -> the bookings they paid for that also sit in
  // the branch scope and are actually sold (PAID/COMPLETED).
  const payments = await Payment.find({ account_id: id, status: Payment.STATUS.PAID }, { booking_id: 1 });
  const paidBookingIds = [...new Set(payments.map((p) => p.booking_id).filter((v) => v != null))];
  const bookings = await Booking.find({
    id: { $in: paidBookingIds },
    account_id: id,
    status: { $in: SOLD_BOOKING_STATUSES },
    ...branchIn('branch_id', branchIds),
  });
  const bookingIds = bookings.map((b) => b.id);

  const [invoices, standaloneCombos, refunds] = await Promise.all([
    Invoice.find({ account_id: id, booking_id: { $in: bookingIds }, status: 1 }),
    ComboOrder.find({
      account_id: id,
      booking_id: null,
      status: { $in: PAID_COMBO_STATUSES },
      ...branchIn('branch_id', branchIds),
    }),
    Refund.find({ account_id: id, status: Refund.STATUS.COMPLETED, ...branchIn('branch_id', branchIds) }),
  ]);

  const ticketRevenue = bookings.reduce((acc, b) => acc + num(b.seat_total), 0);
  const bookingComboSpending = bookings.reduce((acc, b) => acc + num(b.combo_total), 0);
  const standaloneComboSpending = standaloneCombos.reduce((acc, c) => acc + num(c.total_price), 0);
  const discount = bookings.reduce((acc, b) => acc + num(b.discount_amount), 0);
  const refundTotal = refunds.reduce((acc, r) => acc + num(r.amount), 0);

  const totalComboSpending = bookingComboSpending + standaloneComboSpending;
  const totalSpending = ticketRevenue + totalComboSpending - discount - refundTotal;

  const branchIdsSeen = [...new Set(bookings.map((b) => b.branch_id))];
  const branches = await Branch.find({ id: { $in: branchIdsSeen } }, { id: 1, name: 1 });
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const [favoriteGenres, levels] = await Promise.all([
    computeFavoriteGenres(bookings),
    loyaltyService.getActiveLevels(),
  ]);
  const currentLevel = levels.find((l) => l.code === account.membership_level) || null;

  const profile = {
    customer_id: account.id,
    name: account.name || '',
    email: account.email,
    phone: account.phone || '',
    member_since: account.createdAt,
    scope: branchIds == null ? 'ALL' : 'BRANCH',
    branch_ids: branchIds == null ? null : branchIds,

    total_bookings: bookings.length,
    total_tickets: invoices.length,
    total_spending: totalSpending,
    total_combo_spending: totalComboSpending,

    favorite_genres: favoriteGenres,
    favorite_branch: computeFavoriteBranch(bookings, branchNameById),
    last_visit: computeLastVisit(invoices, bookings),

    membership_level: account.membership_level,
    membership_level_name: currentLevel ? currentLevel.name : account.membership_level,
    loyalty_points: account.points_balance,
    lifetime_points: account.lifetime_points,
  };

  if (redact) {
    for (const field of STAFF_REDACTED_FIELDS) delete profile[field];
  }
  return profile;
}

module.exports = {
  CrmAccessError,
  STAFF_REDACTED_FIELDS,
  parseAccountId,
  resolveCrmScope,
  buildCustomerProfile,
};
