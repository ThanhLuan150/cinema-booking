const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const crmService = require('./customerCrm.service');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Category = require('../models/Category');
const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Schedule = require('../models/Schedule');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const ComboOrder = require('../models/ComboOrder');
const Refund = require('../models/Refund');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

// Customer 1 has: two paid bookings at branch 1 (Action + Comedy movies), one paid booking
// at branch 2 (Action), one PENDING booking that must never count, and a completed refund.
// Customer 2 has a single booking at branch 2. Customer 3 has never booked.
async function seedWorld() {
  await Account.create([
    { id: 1, email: 'c1@x.com', password: 'h', name: 'Cus One', phone: '111', membership_level: 'SILVER', points_balance: 320, lifetime_points: 1500 },
    { id: 2, email: 'c2@x.com', password: 'h', name: 'Cus Two', points_balance: 0, lifetime_points: 0 },
    { id: 3, email: 'c3@x.com', password: 'h', name: 'Cus Three', points_balance: 5, lifetime_points: 5 },
  ]);
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 10, name: 'Downtown', code: 'B1' },
    { id: 2, company_id: 1, owner_id: 20, name: 'Uptown', code: 'B2' },
  ]);
  await Category.create([
    { id: 1, name: 'Action' },
    { id: 2, name: 'Comedy' },
  ]);
  await Movie.create([
    { id: 1, name: 'Boom', premiere_date: '2025-01-01', status: 'ACTIVE' },
    { id: 2, name: 'Giggle', premiere_date: '2025-01-01', status: 'ACTIVE' },
  ]);
  await MovieCategory.create([
    { id: 1, movie_id: 1, cat_id: 1 }, // Boom = Action
    { id: 2, movie_id: 2, cat_id: 1 }, // Giggle = Action + Comedy
    { id: 3, movie_id: 2, cat_id: 2 },
  ]);
  await Schedule.create([
    { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
    { id: 2, movie_id: 2, room_id: 1, cinema_id: 1, movie_date: '2026-01-02', time_begin: '10:00', time_end: '12:00', price: 1 },
    { id: 3, movie_id: 1, room_id: 5, cinema_id: 2, movie_date: '2026-01-03', time_begin: '10:00', time_end: '12:00', price: 1 },
  ]);
  await Booking.create([
    { id: 1, code: 'A', account_id: 1, schedule_id: 1, branch_id: 1, ticket_ids: [1, 2], seat_total: 200000, combo_total: 50000, discount_amount: 20000, total_price: 230000, status: 'PAID', paid_at: new Date('2026-01-01T09:00:00Z') },
    { id: 2, code: 'B', account_id: 1, schedule_id: 2, branch_id: 1, ticket_ids: [3], seat_total: 100000, combo_total: 0, discount_amount: 0, total_price: 100000, status: 'COMPLETED', paid_at: new Date('2026-01-02T09:00:00Z') },
    { id: 3, code: 'C', account_id: 1, schedule_id: 3, branch_id: 2, ticket_ids: [4], seat_total: 90000, combo_total: 10000, discount_amount: 0, total_price: 100000, status: 'PAID', paid_at: new Date('2026-01-03T09:00:00Z') },
    { id: 4, code: 'D', account_id: 1, schedule_id: 1, branch_id: 1, ticket_ids: [5], seat_total: 999999, combo_total: 0, discount_amount: 0, total_price: 999999, status: 'PENDING' },
    { id: 5, code: 'E', account_id: 2, schedule_id: 3, branch_id: 2, ticket_ids: [6], seat_total: 70000, combo_total: 0, discount_amount: 0, total_price: 70000, status: 'PAID', paid_at: new Date('2026-01-04T09:00:00Z') },
  ]);
  await Payment.create([
    { id: 1, code: 'A', booking_id: 1, account_id: 1, type: 'ONLINE', method: 'MOMO', amount: 230000, status: 'PAID' },
    { id: 2, code: 'B', booking_id: 2, account_id: 1, type: 'ONLINE', method: 'MOMO', amount: 100000, status: 'PAID' },
    { id: 3, code: 'C', booking_id: 3, account_id: 1, type: 'ONLINE', method: 'MOMO', amount: 100000, status: 'PAID' },
    { id: 4, code: 'D', booking_id: 4, account_id: 1, type: 'ONLINE', method: 'MOMO', amount: 999999, status: 'PENDING' },
    { id: 5, code: 'E', booking_id: 5, account_id: 2, type: 'ONLINE', method: 'MOMO', amount: 70000, status: 'PAID' },
  ]);
  await Invoice.create([
    { id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 100000, status: 1, checked_in_at: new Date('2026-01-01T10:05:00Z') },
    { id: 2, booking_id: 1, ticket_id: 2, account_id: 1, code: 'A', total_price: 100000, status: 1 },
    { id: 3, booking_id: 2, ticket_id: 3, account_id: 1, code: 'B', total_price: 100000, status: 1, checked_in_at: new Date('2026-01-02T10:05:00Z') },
    { id: 4, booking_id: 3, ticket_id: 4, account_id: 1, code: 'C', total_price: 100000, status: 1 },
    { id: 5, booking_id: 4, ticket_id: 5, account_id: 1, code: 'D', total_price: 999999, status: 0 },
  ]);
  await ComboOrder.create([
    { id: 1, code: 'CO-1', branch_id: 1, account_id: 1, booking_id: null, items: [{ combo_id: 1, name: 'x', unit_price: 40000, quantity: 1, line_total: 40000 }], total_price: 40000, status: 'DELIVERED' },
    { id: 2, code: 'CO-2', branch_id: 2, account_id: 1, booking_id: null, items: [{ combo_id: 1, name: 'x', unit_price: 88888, quantity: 1, line_total: 88888 }], total_price: 88888, status: 'CANCELLED' },
  ]);
  await Refund.create([
    { id: 1, booking_id: 1, payment_id: 1, account_id: 1, branch_id: 1, amount: 30000, policy_percent: 50, status: 'COMPLETED', completed_at: new Date('2026-01-05T09:00:00Z') },
    { id: 2, booking_id: 3, payment_id: 3, account_id: 1, branch_id: 2, amount: 77777, policy_percent: 100, status: 'REQUESTED' },
  ]);
}

describe('customerCrm.service.buildCustomerProfile — unscoped (SUPER_ADMIN / own)', () => {
  it('returns null for an account that does not exist', async () => {
    expect(await crmService.buildCustomerProfile({ accountId: 999 })).toBeNull();
  });

  it('aggregates every metric from backend data across all branches', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 1 });

    expect(p.customer_id).toBe(1);
    expect(p.total_bookings).toBe(3); // PENDING booking #4 excluded
    expect(p.total_tickets).toBe(4); // invoices 1-4 (status 1); the cancelled one excluded
    // ticket 390000 + combo (50000 booking + 10000 booking + 40000 standalone DELIVERED) - discount 20000 - refund 30000
    expect(p.total_combo_spending).toBe(100000); // 50000 + 10000 + 40000; CANCELLED standalone excluded
    expect(p.total_spending).toBe(390000 + 100000 - 20000 - 30000);
    expect(p.membership_level).toBe('SILVER');
    expect(p.loyalty_points).toBe(320);
    expect(p.lifetime_points).toBe(1500);
  });

  it('picks the most-booked branch as favorite_branch', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 1 });
    expect(p.favorite_branch).toMatchObject({ branch_id: 1, name: 'Downtown', bookings: 2 });
  });

  it('ranks favorite_genres by number of bookings, Action first', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 1 });
    expect(p.favorite_genres.map((g) => g.name)).toEqual(['Action', 'Comedy']);
    expect(p.favorite_genres[0]).toMatchObject({ name: 'Action', bookings: 3 });
    expect(p.favorite_genres[1]).toMatchObject({ name: 'Comedy', bookings: 1 });
  });

  it('uses the latest ticket check-in as last_visit', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 1 });
    expect(new Date(p.last_visit).toISOString()).toBe('2026-01-02T10:05:00.000Z');
  });

  it('falls back to the latest payment date when the customer has never checked in', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 2 });
    expect(new Date(p.last_visit).toISOString()).toBe('2026-01-04T09:00:00.000Z');
    expect(p.total_bookings).toBe(1);
  });

  it('returns zeroed metrics (not null) for a customer who has never booked', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 3 });
    expect(p).toMatchObject({ total_bookings: 0, total_tickets: 0, total_spending: 0, favorite_branch: null, favorite_genres: [], last_visit: null });
  });

  it('never exposes password / credential / token fields', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 1 });
    const serialized = JSON.stringify(p);
    expect(serialized).not.toMatch(/password|refreshToken|"otp"|gateway|card_number|cvv/i);
  });
});

describe('customerCrm.service.buildCustomerProfile — branch-scoped', () => {
  it('counts only activity inside the given branches', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 1, branchIds: [1] });
    expect(p.scope).toBe('BRANCH');
    expect(p.total_bookings).toBe(2); // branch-1 bookings only
    // ticket 300000 + combo (50000 booking + 40000 standalone at branch 1) - discount 20000 - refund 30000
    expect(p.total_spending).toBe(300000 + 90000 - 20000 - 30000);
    expect(p.favorite_branch.branch_id).toBe(1);
  });

  it('excludes a refund raised at a branch outside the scope', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 1, branchIds: [2] });
    expect(p.total_bookings).toBe(1);
    // branch 2: ticket 90000 + combo 10000 (booking) - 0 discount - 0 refund (the completed refund was at branch 1)
    expect(p.total_spending).toBe(100000);
  });
});

describe('customerCrm.service.buildCustomerProfile — redaction', () => {
  it('drops marketing-analytics fields for EMPLOYEE callers', async () => {
    await seedWorld();
    const p = await crmService.buildCustomerProfile({ accountId: 1, branchIds: [1], redact: true });
    for (const field of crmService.STAFF_REDACTED_FIELDS) expect(p).not.toHaveProperty(field);
    // but the operationally-useful figures stay
    expect(p).toHaveProperty('total_spending');
    expect(p).toHaveProperty('total_bookings');
    expect(p).toHaveProperty('loyalty_points');
    expect(p).toHaveProperty('last_visit');
    expect(p).toHaveProperty('favorite_branch');
  });
});

describe('customerCrm.service.resolveCrmScope', () => {
  it('gives an ALL-scope caller an unrestricted (null) branch scope', async () => {
    const scope = await crmService.resolveCrmScope({ permissionScope: 'ALL', account: { accountId: 1 } });
    expect(scope).toEqual({ branchIds: null });
  });

  it('restricts a BRANCH-scope caller to their accessible branches', async () => {
    await Branch.create({ id: 7, company_id: 1, owner_id: 42, name: 'Mine', code: 'M' });
    const scope = await crmService.resolveCrmScope({ permissionScope: 'BRANCH', account: { accountId: 42 } });
    expect(scope).toEqual({ branchIds: [7] });
  });

  it('throws for a BRANCH caller with no accessible branch', async () => {
    await expect(
      crmService.resolveCrmScope({ permissionScope: 'BRANCH', account: { accountId: 999 } }),
    ).rejects.toBeInstanceOf(crmService.CrmAccessError);
  });

  it('throws for any other scope (OWN / undefined)', async () => {
    await expect(
      crmService.resolveCrmScope({ permissionScope: 'OWN', account: { accountId: 1 } }),
    ).rejects.toBeInstanceOf(crmService.CrmAccessError);
  });
});
