const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const ComboOrder = require('../models/ComboOrder');
const Refund = require('../models/Refund');
const Invoice = require('../models/Invoice');
const Schedule = require('../models/Schedule');
const Movie = require('../models/Movie');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const MaintenanceRequest = require('../models/MaintenanceRequest');

// Ticket 28 — Revenue Reporting data access. Every exported function takes a `branchIds`
// argument that is the ONLY branch-scope filter: `null`/`undefined` = no restriction
// (SUPER_ADMIN ALL), an array = restrict to exactly those branches (BRANCH scope). The
// reporting.service produces that array from the caller's permission scope. Revenue is
// derived from valid payment transactions (Payment.status === 'PAID') joined to their
// Booking, never a naive sum of Booking.total_price:
//   netRevenue = ticketRevenue + comboRevenue - discount - refund

const PAID_COMBO_STATUSES = [
  ComboOrder.STATUS.PAID,
  ComboOrder.STATUS.PREPARING,
  ComboOrder.STATUS.READY,
  ComboOrder.STATUS.DELIVERED,
];

const SOLD_BOOKING_STATUSES = [Booking.STATUS.PAID, Booking.STATUS.COMPLETED];

// Every operational metric this repository can compute. The reporting service maps each to
// the permission that makes it relevant — see OPERATIONAL_METRICS there.
const OPERATIONAL_METRIC_KEYS = {
  showtimesToday: 'showtimesToday',
  ticketsIssuedToday: 'ticketsIssuedToday',
  ticketsCheckedInToday: 'ticketsCheckedInToday',
  pendingComboOrders: 'pendingComboOrders',
  openMaintenance: 'openMaintenance',
};

// --- filter helpers ------------------------------------------------------------

function branchIn(field, branchIds) {
  if (branchIds == null) return {};
  return { [field]: { $in: branchIds.map(Number) } };
}

// Inclusive range on a Date field. `from`/`to` are 'YYYY-MM-DD' strings (or falsy);
// `to` is widened to the end of that UTC day. Returns {} when neither bound is set.
function dateRange(field, from, to) {
  if (!from && !to) return {};
  const cond = {};
  if (from) cond.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) cond.$lte = new Date(`${to}T23:59:59.999Z`);
  return { [field]: cond };
}

function num(value) {
  return Number(value) || 0;
}

function sumBy(rows, key) {
  return rows.reduce((acc, row) => acc + num(row[key]), 0);
}

function dayOf(date) {
  return new Date(date).toISOString().split('T')[0];
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

// --- shared load -------------------------------------------------------------

// Loads the PAID payments in the window and the subset of their bookings that fall inside
// the branch scope. `payments` keeps every paid payment (so callers can bucket by day),
// `bookings` is already branch-filtered.
async function loadPaidBookingContext({ branchIds, from, to } = {}) {
  const payments = await Payment.find({
    status: Payment.STATUS.PAID,
    ...dateRange('paid_at', from, to),
  });
  const bookingIds = [...new Set(payments.map((p) => p.booking_id).filter((v) => v != null))];
  const bookings = await Booking.find({
    id: { $in: bookingIds },
    ...branchIn('branch_id', branchIds),
  });
  return { payments, bookings };
}

async function loadStandaloneCombos({ branchIds, from, to } = {}) {
  return ComboOrder.find({
    booking_id: null,
    status: { $in: PAID_COMBO_STATUSES },
    ...branchIn('branch_id', branchIds),
    ...dateRange('paid_at', from, to),
  });
}

async function loadCompletedRefunds({ branchIds, from, to } = {}) {
  return Refund.find({
    status: Refund.STATUS.COMPLETED,
    ...branchIn('branch_id', branchIds),
    ...dateRange('completed_at', from, to),
  });
}

// --- reports ---------------------------------------------------------------

// { ticketRevenue, comboRevenue, discount, refund, netRevenue }
async function getRevenueBreakdown({ branchIds, from, to } = {}) {
  const [{ bookings }, standaloneCombos, refunds] = await Promise.all([
    loadPaidBookingContext({ branchIds, from, to }),
    loadStandaloneCombos({ branchIds, from, to }),
    loadCompletedRefunds({ branchIds, from, to }),
  ]);

  const ticketRevenue = sumBy(bookings, 'seat_total');
  const bookingComboRevenue = sumBy(bookings, 'combo_total');
  const discount = sumBy(bookings, 'discount_amount');
  const standaloneComboRevenue = sumBy(standaloneCombos, 'total_price');
  const comboRevenue = bookingComboRevenue + standaloneComboRevenue;
  const refund = sumBy(refunds, 'amount');
  const netRevenue = ticketRevenue + comboRevenue - discount - refund;

  return { ticketRevenue, comboRevenue, discount, refund, netRevenue };
}

// Counts. `movieCount` is only meaningful system-wide, so it's null when branch-scoped.
async function getTotals({ branchIds } = {}) {
  const [branchCount, employeeCount, showtimeCount] = await Promise.all([
    Branch.countDocuments(branchIn('id', branchIds)),
    Employee.countDocuments({ status: 1, ...branchIn('branch_id', branchIds) }),
    Schedule.countDocuments({ status: 'ACTIVE', ...branchIn('cinema_id', branchIds) }),
  ]);

  const paidBookings = await Booking.find(
    { status: { $in: SOLD_BOOKING_STATUSES }, ...branchIn('branch_id', branchIds) },
    { id: 1 },
  );
  const bookingCount = paidBookings.length;
  const ticketCount = await Invoice.countDocuments({
    status: 1,
    booking_id: { $in: paidBookings.map((b) => b.id) },
  });

  const movieCount = branchIds == null ? await Movie.countDocuments({ status: 'ACTIVE' }) : null;

  return { branchCount, employeeCount, movieCount, showtimeCount, bookingCount, ticketCount };
}

// [{ branchId, branchName, ticketRevenue, comboRevenue, discount, refund, netRevenue }]
// sorted by netRevenue desc.
async function getRevenueByBranch({ branchIds, from, to } = {}) {
  const [{ bookings }, standaloneCombos, refunds] = await Promise.all([
    loadPaidBookingContext({ branchIds, from, to }),
    loadStandaloneCombos({ branchIds, from, to }),
    loadCompletedRefunds({ branchIds, from, to }),
  ]);

  const byBranch = new Map();
  const bucket = (id) => {
    if (!byBranch.has(id)) {
      byBranch.set(id, { ticketRevenue: 0, comboRevenue: 0, discount: 0, refund: 0 });
    }
    return byBranch.get(id);
  };

  for (const b of bookings) {
    const x = bucket(b.branch_id);
    x.ticketRevenue += num(b.seat_total);
    x.comboRevenue += num(b.combo_total);
    x.discount += num(b.discount_amount);
  }
  for (const c of standaloneCombos) bucket(c.branch_id).comboRevenue += num(c.total_price);
  for (const r of refunds) bucket(r.branch_id).refund += num(r.amount);

  const ids = [...byBranch.keys()];
  const branches = await Branch.find({ id: { $in: ids } }, { id: 1, name: 1 });
  const nameById = new Map(branches.map((b) => [b.id, b.name]));

  return ids
    .map((id) => {
      const x = byBranch.get(id);
      return {
        branchId: id,
        branchName: nameById.get(id) || `#${id}`,
        ticketRevenue: x.ticketRevenue,
        comboRevenue: x.comboRevenue,
        discount: x.discount,
        refund: x.refund,
        netRevenue: x.ticketRevenue + x.comboRevenue - x.discount - x.refund,
      };
    })
    .sort((a, b) => b.netRevenue - a.netRevenue);
}

// [{ movieId, name, ticketsSold, revenue }] — ticket revenue only, sorted by revenue desc.
async function getTopMovies({ branchIds, from, to, limit = 5 } = {}) {
  const { bookings } = await loadPaidBookingContext({ branchIds, from, to });
  if (bookings.length === 0) return [];

  const scheduleIds = [...new Set(bookings.map((b) => b.schedule_id))];
  const schedules = await Schedule.find({ id: { $in: scheduleIds } }, { id: 1, movie_id: 1 });
  const movieIdByScheduleId = new Map(schedules.map((s) => [s.id, s.movie_id]));

  const byMovie = new Map();
  for (const b of bookings) {
    const movieId = movieIdByScheduleId.get(b.schedule_id);
    if (movieId == null) continue;
    if (!byMovie.has(movieId)) byMovie.set(movieId, { revenue: 0, ticketsSold: 0 });
    const x = byMovie.get(movieId);
    x.revenue += num(b.seat_total);
    x.ticketsSold += Array.isArray(b.ticket_ids) ? b.ticket_ids.length : 0;
  }

  const movieIds = [...byMovie.keys()];
  const movies = await Movie.find({ id: { $in: movieIds } }, { id: 1, name: 1 });
  const nameById = new Map(movies.map((m) => [m.id, m.name]));

  return movieIds
    .map((id) => ({
      movieId: id,
      name: nameById.get(id) || `#${id}`,
      ticketsSold: byMovie.get(id).ticketsSold,
      revenue: byMovie.get(id).revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.ticketsSold - a.ticketsSold)
    .slice(0, limit);
}

async function getRefundSummary({ branchIds, from, to } = {}) {
  const [raised, completed] = await Promise.all([
    Refund.find({ ...branchIn('branch_id', branchIds), ...dateRange('createdAt', from, to) }),
    loadCompletedRefunds({ branchIds, from, to }),
  ]);

  const byStatus = {};
  for (const status of Object.values(Refund.STATUS)) byStatus[status] = { count: 0, amount: 0 };
  for (const r of raised) {
    const b = byStatus[r.status] || (byStatus[r.status] = { count: 0, amount: 0 });
    b.count += 1;
    b.amount += num(r.amount);
  }

  return { count: completed.length, amount: sumBy(completed, 'amount'), byStatus };
}

// [{ date: 'YYYY-MM-DD', total }] ascending. total = (ticket + combo - discount) booked on
// the payment's day, plus standalone combos on their paid day, minus refunds on the day
// the money went back.
async function getRevenueByDay({ branchIds, from, to } = {}) {
  const [{ payments, bookings }, standaloneCombos, refunds] = await Promise.all([
    loadPaidBookingContext({ branchIds, from, to }),
    loadStandaloneCombos({ branchIds, from, to }),
    loadCompletedRefunds({ branchIds, from, to }),
  ]);

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const byDay = new Map();
  const add = (date, amount) => byDay.set(date, (byDay.get(date) || 0) + amount);

  for (const p of payments) {
    const booking = bookingById.get(p.booking_id);
    if (!booking) continue; // outside the branch scope
    add(dayOf(p.paid_at || p.createdAt), num(booking.seat_total) + num(booking.combo_total) - num(booking.discount_amount));
  }
  for (const c of standaloneCombos) add(dayOf(c.paid_at || c.createdAt), num(c.total_price));
  for (const r of refunds) add(dayOf(r.completed_at || r.createdAt), -num(r.amount));

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, total]) => ({ date, total }));
}

// Non-financial "what's happening right now" counters. `keys` selects which ones to compute —
// the reporting service derives it from the caller's own permissions so an employee only ever
// sees what their Position actually does (Ticket 28's "operational metrics theo Position").
// Anything not asked for is neither queried nor returned, so an absent key means "not
// permitted" and is never confused with a genuine 0.
async function getOperationalSummary({ branchIds, keys } = {}) {
  const wanted = new Set(keys ?? Object.keys(OPERATIONAL_METRIC_KEYS));
  if (wanted.size === 0) return {};

  const today = todayIso();
  const branchScope = branchIn('branch_id', branchIds);
  const dayWindow = { $gte: new Date(`${today}T00:00:00.000Z`), $lte: new Date(`${today}T23:59:59.999Z`) };

  // Both ticket counters need the branch's bookings; resolve that once, and only if asked.
  let bookingScope = {};
  if (branchIds != null && (wanted.has('ticketsIssuedToday') || wanted.has('ticketsCheckedInToday'))) {
    const ids = (await Booking.find(branchScope, { id: 1 })).map((b) => b.id);
    bookingScope = { booking_id: { $in: ids } };
  }

  const counters = {
    showtimesToday: () =>
      Schedule.countDocuments({ movie_date: today, status: 'ACTIVE', ...branchIn('cinema_id', branchIds) }),
    ticketsIssuedToday: () => Invoice.countDocuments({ issued_at: dayWindow, ...bookingScope }),
    ticketsCheckedInToday: () => Invoice.countDocuments({ checked_in_at: dayWindow, ...bookingScope }),
    pendingComboOrders: () =>
      ComboOrder.countDocuments({
        status: { $in: [ComboOrder.STATUS.PENDING, ComboOrder.STATUS.PAID, ComboOrder.STATUS.PREPARING] },
        ...branchScope,
      }),
    openMaintenance: () =>
      MaintenanceRequest.countDocuments({ status: { $in: MaintenanceRequest.ACTIVE_STATUSES }, ...branchScope }),
  };

  const selected = Object.keys(counters).filter((key) => wanted.has(key));
  const values = await Promise.all(selected.map((key) => counters[key]()));
  return Object.fromEntries(selected.map((key, i) => [key, values[i]]));
}

module.exports = {
  OPERATIONAL_METRIC_KEYS,
  getRevenueBreakdown,
  getTotals,
  getRevenueByBranch,
  getTopMovies,
  getRefundSummary,
  getRevenueByDay,
  getOperationalSummary,
};
