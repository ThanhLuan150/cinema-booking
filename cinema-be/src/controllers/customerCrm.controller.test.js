const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const controller = require('./customerCrm.controller');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Schedule = require('../models/Schedule');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

// Customer 1 books at branch 1 (owned by admin 42). Customer 2 books at branch 2 (owner 99).
async function seedWorld() {
  await Account.create([
    { id: 1, email: 'c1@x.com', password: 'h', name: 'One', points_balance: 100, lifetime_points: 100 },
    { id: 2, email: 'c2@x.com', password: 'h', name: 'Two', points_balance: 0, lifetime_points: 0 },
  ]);
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'B1' },
    { id: 2, company_id: 1, owner_id: 99, name: 'Theirs', code: 'B2' },
  ]);
  await Schedule.create([
    { id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
    { id: 2, movie_id: 1, room_id: 9, cinema_id: 2, movie_date: '2026-01-02', time_begin: '10:00', time_end: '12:00', price: 1 },
  ]);
  await Booking.create([
    { id: 1, code: 'A', account_id: 1, schedule_id: 1, branch_id: 1, ticket_ids: [1], seat_total: 100000, combo_total: 0, discount_amount: 0, total_price: 100000, status: 'PAID', paid_at: new Date('2026-01-01T09:00:00Z') },
    { id: 2, code: 'B', account_id: 2, schedule_id: 2, branch_id: 2, ticket_ids: [2], seat_total: 80000, combo_total: 0, discount_amount: 0, total_price: 80000, status: 'PAID', paid_at: new Date('2026-01-02T09:00:00Z') },
  ]);
  await Payment.create([
    { id: 1, code: 'A', booking_id: 1, account_id: 1, type: 'ONLINE', method: 'MOMO', amount: 100000, status: 'PAID' },
    { id: 2, code: 'B', booking_id: 2, account_id: 2, type: 'ONLINE', method: 'MOMO', amount: 80000, status: 'PAID' },
  ]);
  await Invoice.create([
    { id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 100000, status: 1 },
    { id: 2, booking_id: 2, ticket_id: 2, account_id: 2, code: 'B', total_price: 80000, status: 1 },
  ]);
}

describe('customerCrm.controller.myProfile', () => {
  it('returns the caller their own aggregated profile', async () => {
    await seedWorld();
    const res = mockRes();
    await controller.myProfile({ account: { accountId: 1 } }, res);
    const [payload] = res.json.mock.calls[0];
    expect(payload).toMatchObject({ customer_id: 1, total_bookings: 1, total_spending: 100000, scope: 'ALL' });
  });

  it('404s when the account no longer exists', async () => {
    const res = mockRes();
    await controller.myProfile({ account: { accountId: 12345 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('customerCrm.controller.customerProfile — authorization', () => {
  it('rejects an OWN-scope caller (a customer poking the staff endpoint)', async () => {
    await seedWorld();
    const res = mockRes();
    await controller.customerProfile(
      { params: { accountId: '1' }, account: { accountId: 1 }, permissionScope: 'OWN', roleCode: 'CUSTOMER' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects a caller with no resolvable scope', async () => {
    await seedWorld();
    const res = mockRes();
    await controller.customerProfile(
      { params: { accountId: '1' }, account: { accountId: 1 }, permissionScope: undefined, roleCode: 'CUSTOMER' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('lets a SUPER_ADMIN (ALL) read any customer with system-wide figures', async () => {
    await seedWorld();
    const res = mockRes();
    await controller.customerProfile(
      { params: { accountId: '2' }, account: { accountId: 500 }, permissionScope: 'ALL', roleCode: 'SUPER_ADMIN' },
      res,
    );
    const [payload] = res.json.mock.calls[0];
    expect(payload).toMatchObject({ customer_id: 2, scope: 'ALL', total_bookings: 1 });
    expect(payload).toHaveProperty('favorite_genres'); // not redacted
  });

  it('scopes a BRANCH_ADMIN to their own branch', async () => {
    await seedWorld();
    const res = mockRes();
    await controller.customerProfile(
      { params: { accountId: '1' }, account: { accountId: 42 }, permissionScope: 'BRANCH', roleCode: 'BRANCH_ADMIN' },
      res,
    );
    const [payload] = res.json.mock.calls[0];
    expect(payload).toMatchObject({ customer_id: 1, scope: 'BRANCH', branch_ids: [1], total_bookings: 1 });
  });

  it("404s a BRANCH_ADMIN asking for a customer who never transacted at their branch", async () => {
    await seedWorld();
    const res = mockRes();
    await controller.customerProfile(
      { params: { accountId: '2' }, account: { accountId: 42 }, permissionScope: 'BRANCH', roleCode: 'BRANCH_ADMIN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('redacts marketing-analytics fields for an EMPLOYEE caller', async () => {
    await seedWorld();
    const res = mockRes();
    await controller.customerProfile(
      { params: { accountId: '1' }, account: { accountId: 42 }, permissionScope: 'BRANCH', roleCode: 'EMPLOYEE' },
      res,
    );
    const [payload] = res.json.mock.calls[0];
    expect(payload).not.toHaveProperty('favorite_genres');
    expect(payload).not.toHaveProperty('total_combo_spending');
    expect(payload).toHaveProperty('loyalty_points');
  });

  it('404s for a non-existent customer id', async () => {
    await seedWorld();
    const res = mockRes();
    await controller.customerProfile(
      { params: { accountId: '99999' }, account: { accountId: 500 }, permissionScope: 'ALL', roleCode: 'SUPER_ADMIN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects a malformed customer id', async () => {
    const res = mockRes();
    await controller.customerProfile(
      { params: { accountId: 'abc' }, account: { accountId: 500 }, permissionScope: 'ALL', roleCode: 'SUPER_ADMIN' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('never reflects client-supplied figures — the body is ignored, everything is recomputed', async () => {
    await seedWorld();
    const res = mockRes();
    await controller.customerProfile(
      {
        params: { accountId: '1' },
        account: { accountId: 500 },
        permissionScope: 'ALL',
        roleCode: 'SUPER_ADMIN',
        body: { total_spending: 999999999, total_bookings: 4242, loyalty_points: 777777 },
      },
      res,
    );
    const [payload] = res.json.mock.calls[0];
    expect(payload.total_spending).toBe(100000);
    expect(payload.total_bookings).toBe(1);
    expect(payload.loyalty_points).toBe(100);
  });
});
