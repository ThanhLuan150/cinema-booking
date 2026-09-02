const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const reportingRepository = require('./reporting.repository');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Movie = require('../models/Movie');
const Schedule = require('../models/Schedule');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const ComboOrder = require('../models/ComboOrder');
const Refund = require('../models/Refund');
const MaintenanceRequest = require('../models/MaintenanceRequest');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedWorld() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 10, name: 'Branch One', code: 'B1' },
    { id: 2, company_id: 1, owner_id: 20, name: 'Branch Two', code: 'B2' },
  ]);
  await Movie.create([
    { id: 1, name: 'Alpha', premiere_date: '2025-01-01', status: 'ACTIVE' },
    { id: 2, name: 'Beta', premiere_date: '2025-01-01', status: 'ACTIVE' },
    { id: 3, name: 'Gamma (inactive)', premiere_date: '2025-01-01', status: 'INACTIVE' },
  ]);
  await Employee.create([
    { id: 1, user_id: 101, branch_id: 1, employee_code: 'E1', position_id: 1, status: 1 },
    { id: 2, user_id: 102, branch_id: 1, employee_code: 'E2', position_id: 1, status: 1 },
    { id: 3, user_id: 103, branch_id: 1, employee_code: 'E3', position_id: 1, status: 0 }, // inactive
    { id: 4, user_id: 104, branch_id: 2, employee_code: 'E4', position_id: 1, status: 1 },
  ]);
  await Schedule.create([
    { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1, status: 'ACTIVE' },
    { id: 2, movie_id: 2, room_id: 2, cinema_id: 2, movie_date: '2026-01-02', time_begin: '10:00', time_end: '12:00', price: 1, status: 'ACTIVE' },
    { id: 3, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-03', time_begin: '10:00', time_end: '12:00', price: 1, status: 'CANCELLED' },
  ]);
  await Booking.create([
    { id: 1, code: 'A', account_id: 1, schedule_id: 1, branch_id: 1, ticket_ids: [1, 2], seat_total: 100000, combo_total: 30000, discount_amount: 10000, total_price: 120000, status: 'PAID' },
    { id: 2, code: 'B', account_id: 2, schedule_id: 2, branch_id: 2, ticket_ids: [3], seat_total: 50000, combo_total: 0, discount_amount: 0, total_price: 50000, status: 'PAID' },
    { id: 3, code: 'C', account_id: 3, schedule_id: 1, branch_id: 1, ticket_ids: [4], seat_total: 999999, combo_total: 0, discount_amount: 0, total_price: 999999, status: 'PAID' },
  ]);
  await Payment.create([
    { id: 1, code: 'A', booking_id: 1, account_id: 1, type: 'ONLINE', method: 'MOMO', amount: 120000, status: 'PAID', paid_at: new Date('2026-01-01T09:00:00Z') },
    { id: 2, code: 'B', booking_id: 2, account_id: 2, type: 'ONLINE', method: 'MOMO', amount: 50000, status: 'PAID', paid_at: new Date('2026-01-02T09:00:00Z') },
    { id: 3, code: 'C', booking_id: 3, account_id: 3, type: 'ONLINE', method: 'MOMO', amount: 999999, status: 'FAILED' },
  ]);
  await Invoice.create([
    { id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 60000, status: 1 },
    { id: 2, booking_id: 1, ticket_id: 2, account_id: 1, code: 'A', total_price: 60000, status: 1 },
    { id: 3, booking_id: 2, ticket_id: 3, account_id: 2, code: 'B', total_price: 50000, status: 1 },
    { id: 4, booking_id: 3, ticket_id: 4, account_id: 3, code: 'C', total_price: 999999, status: 0 }, // cancelled
  ]);
  await ComboOrder.create([
    { id: 1, code: 'CO-1', branch_id: 1, booking_id: null, items: [{ combo_id: 1, name: 'x', unit_price: 25000, quantity: 1, line_total: 25000 }], total_price: 25000, status: 'PAID', paid_at: new Date('2026-01-01T12:00:00Z') },
    { id: 2, code: 'CO-2', branch_id: 1, booking_id: null, items: [{ combo_id: 1, name: 'x', unit_price: 88888, quantity: 1, line_total: 88888 }], total_price: 88888, status: 'PENDING' },
  ]);
  await Refund.create([
    { id: 1, booking_id: 1, payment_id: 1, account_id: 1, branch_id: 1, amount: 20000, policy_percent: 50, status: 'COMPLETED', completed_at: new Date('2026-01-03T09:00:00Z') },
    { id: 2, booking_id: 3, payment_id: 3, account_id: 3, branch_id: 1, amount: 77777, policy_percent: 100, status: 'REQUESTED' },
  ]);
}

describe('reporting.repository.getRevenueBreakdown', () => {
  it('applies netRevenue = ticket + combo - discount - refund across all branches', async () => {
    await seedWorld();
    const r = await reportingRepository.getRevenueBreakdown({ branchIds: null });
    expect(r).toEqual({
      ticketRevenue: 150000, // 100000 (A) + 50000 (B)
      comboRevenue: 55000, //   30000 (A) + 25000 (standalone PAID); PENDING combo excluded
      discount: 10000,
      refund: 20000, //         COMPLETED only; REQUESTED excluded
      netRevenue: 175000,
    });
  });

  it('excludes bookings whose payment is not PAID', async () => {
    await seedWorld();
    const r = await reportingRepository.getRevenueBreakdown({ branchIds: null });
    // Booking C has seat_total 999999 but its Payment is FAILED -> must not leak in.
    expect(r.ticketRevenue).toBe(150000);
  });

  it('isolates one branch from another', async () => {
    await seedWorld();
    const b1 = await reportingRepository.getRevenueBreakdown({ branchIds: [1] });
    const b2 = await reportingRepository.getRevenueBreakdown({ branchIds: [2] });
    expect(b1).toMatchObject({ ticketRevenue: 100000, comboRevenue: 55000, discount: 10000, refund: 20000, netRevenue: 125000 });
    expect(b2).toMatchObject({ ticketRevenue: 50000, comboRevenue: 0, discount: 0, refund: 0, netRevenue: 50000 });
  });

  it('filters by date range on the payment / combo / refund timestamps', async () => {
    await seedWorld();
    const jan1 = await reportingRepository.getRevenueBreakdown({ branchIds: null, from: '2026-01-01', to: '2026-01-01' });
    // Only Booking A (paid 01-01) + standalone combo (paid 01-01); refund is on 01-03.
    expect(jan1).toMatchObject({ ticketRevenue: 100000, comboRevenue: 55000, discount: 10000, refund: 0, netRevenue: 145000 });
  });
});

describe('reporting.repository.getTotals', () => {
  it('counts system-wide and includes movieCount when unscoped', async () => {
    await seedWorld();
    const t = await reportingRepository.getTotals({ branchIds: null });
    expect(t).toEqual({
      branchCount: 2,
      employeeCount: 3, // active only
      movieCount: 2, //    ACTIVE only
      showtimeCount: 2, // ACTIVE only
      bookingCount: 3, //  PAID/COMPLETED bookings
      ticketCount: 3, //   status-1 invoices under those bookings
    });
  });

  it('scopes counts to the branch and nulls movieCount', async () => {
    await seedWorld();
    const t = await reportingRepository.getTotals({ branchIds: [1] });
    expect(t).toMatchObject({
      branchCount: 1,
      employeeCount: 2,
      movieCount: null,
      showtimeCount: 1,
      bookingCount: 2, // A + C
      ticketCount: 2, //  inv1 + inv2 (inv4 is cancelled)
    });
  });
});

describe('reporting.repository.getRevenueByBranch', () => {
  it('splits net revenue per branch, sorted desc', async () => {
    await seedWorld();
    const rows = await reportingRepository.getRevenueByBranch({ branchIds: null });
    expect(rows.map((r) => [r.branchId, r.netRevenue])).toEqual([
      [1, 125000],
      [2, 50000],
    ]);
    expect(rows[0].branchName).toBe('Branch One');
  });
});

describe('reporting.repository.getTopMovies', () => {
  it('ranks movies by ticket revenue with tickets-sold counts', async () => {
    await seedWorld();
    const rows = await reportingRepository.getTopMovies({ branchIds: null });
    expect(rows).toEqual([
      { movieId: 1, name: 'Alpha', ticketsSold: 2, revenue: 100000 },
      { movieId: 2, name: 'Beta', ticketsSold: 1, revenue: 50000 },
    ]);
  });

  it('respects branch scope', async () => {
    await seedWorld();
    const rows = await reportingRepository.getTopMovies({ branchIds: [2] });
    expect(rows).toEqual([{ movieId: 2, name: 'Beta', ticketsSold: 1, revenue: 50000 }]);
  });
});

describe('reporting.repository.getRefundSummary', () => {
  it('reports COMPLETED totals plus a per-status breakdown', async () => {
    await seedWorld();
    const s = await reportingRepository.getRefundSummary({ branchIds: null });
    expect(s.count).toBe(1);
    expect(s.amount).toBe(20000);
    expect(s.byStatus.COMPLETED).toEqual({ count: 1, amount: 20000 });
    expect(s.byStatus.REQUESTED).toEqual({ count: 1, amount: 77777 });
    expect(s.byStatus.FAILED).toEqual({ count: 0, amount: 0 });
  });

  // The "− Refund" line of the breakdown and this card's total are shown side by side, so
  // they must always describe the same set of refunds for a given range.
  it('agrees with getRevenueBreakdown for a refund requested and paid out in different months', async () => {
    await Refund.create({
      id: 1,
      booking_id: 1,
      payment_id: 1,
      account_id: 1,
      branch_id: 1,
      amount: 50000,
      policy_percent: 100,
      status: 'COMPLETED',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      completed_at: new Date('2026-02-10T00:00:00Z'),
    });
    const february = { branchIds: null, from: '2026-02-01', to: '2026-02-28' };

    const breakdown = await reportingRepository.getRevenueBreakdown(february);
    const summary = await reportingRepository.getRefundSummary(february);
    expect(summary.amount).toBe(breakdown.refund);
    expect(summary.amount).toBe(50000);
    // ...while byStatus still reports on when the refund was *raised* (January), so a
    // pending request in the window is never hidden.
    expect(summary.byStatus.COMPLETED.count).toBe(0);
  });

  it('keeps still-pending refunds visible in byStatus even though they have no completed_at', async () => {
    await Refund.create({
      id: 1,
      booking_id: 1,
      payment_id: 1,
      account_id: 1,
      branch_id: 1,
      amount: 12000,
      policy_percent: 100,
      status: 'REQUESTED',
      createdAt: new Date('2026-03-05T00:00:00Z'),
    });
    const march = { branchIds: null, from: '2026-03-01', to: '2026-03-31' };

    const summary = await reportingRepository.getRefundSummary(march);
    expect(summary.byStatus.REQUESTED).toEqual({ count: 1, amount: 12000 });
    expect(summary.amount).toBe(0); // no money has actually left yet
  });
});

describe('reporting.repository.getRevenueByDay', () => {
  it('buckets ticket+combo income and refund outflow by calendar day, ascending', async () => {
    await seedWorld();
    const rows = await reportingRepository.getRevenueByDay({ branchIds: null });
    expect(rows).toEqual([
      { date: '2026-01-01', total: 145000 }, // A: 100000+30000-10000, + standalone combo 25000
      { date: '2026-01-02', total: 50000 }, //  B
      { date: '2026-01-03', total: -20000 }, // refund
    ]);
  });
});

describe('reporting.repository.getOperationalSummary', () => {
  it('counts today\'s operational activity, branch-scoped', async () => {
    const today = new Date().toISOString().split('T')[0];
    await Branch.create({ id: 1, company_id: 1, owner_id: 10, name: 'B1', code: 'B1' });
    await Schedule.create([
      { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: today, time_begin: '10:00', time_end: '12:00', price: 1, status: 'ACTIVE' },
      { id: 2, movie_id: 1, room_id: 9, cinema_id: 2, movie_date: today, time_begin: '10:00', time_end: '12:00', price: 1, status: 'ACTIVE' },
    ]);
    await Booking.create({ id: 1, code: 'A', account_id: 1, schedule_id: 1, branch_id: 1, total_price: 1, status: 'PAID' });
    await Invoice.create([
      { id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, status: 1, issued_at: new Date(), checked_in_at: new Date() },
      { id: 2, booking_id: 1, ticket_id: 2, account_id: 1, code: 'A', total_price: 1, status: 1, issued_at: new Date() },
    ]);
    await ComboOrder.create({ id: 1, code: 'CO-1', branch_id: 1, items: [{ combo_id: 1, name: 'x', unit_price: 1, quantity: 1, line_total: 1 }], total_price: 1, status: 'PREPARING' });
    await MaintenanceRequest.create({ id: 1, branch_id: 1, resource_type: 'PROJECTOR', title: 'broken', reported_by: 1, status: 'OPEN' });

    const s = await reportingRepository.getOperationalSummary({ branchIds: [1] });
    expect(s).toEqual({
      showtimesToday: 1, // branch 2's showtime excluded
      ticketsIssuedToday: 2,
      ticketsCheckedInToday: 1,
      pendingComboOrders: 1,
      openMaintenance: 1,
    });
  });

  it('computes only the requested keys, so an unpermitted metric is absent rather than 0', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 10, name: 'B1', code: 'B1' });
    await ComboOrder.create({
      id: 1, code: 'CO-1', branch_id: 1,
      items: [{ combo_id: 1, name: 'x', unit_price: 1, quantity: 1, line_total: 1 }],
      total_price: 1, status: 'PREPARING',
    });

    const s = await reportingRepository.getOperationalSummary({ branchIds: [1], keys: ['pendingComboOrders'] });
    expect(s).toEqual({ pendingComboOrders: 1 });
    expect(s).not.toHaveProperty('showtimesToday');
    expect(s).not.toHaveProperty('openMaintenance');
  });

  it('returns nothing at all when no metric is permitted', async () => {
    expect(await reportingRepository.getOperationalSummary({ branchIds: [1], keys: [] })).toEqual({});
  });
});
