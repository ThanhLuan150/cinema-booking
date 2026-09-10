const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const customerCrmRoutes = require('./customerCrm.routes');
const Account = require('../models/Account');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Position = require('../models/Position');
const Schedule = require('../models/Schedule');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

const app = buildTestApp('/api/crm', customerCrmRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedCustomer1AtBranch1() {
  await Account.create({ id: 7, email: 'c@x.com', password: 'h', name: 'Cus', points_balance: 10, lifetime_points: 10 });
  await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'B1' });
  await Schedule.create({ id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
  await Booking.create({ id: 1, code: 'A', account_id: 7, schedule_id: 1, branch_id: 1, ticket_ids: [1], seat_total: 100000, combo_total: 0, discount_amount: 0, total_price: 100000, status: 'PAID', paid_at: new Date('2026-01-01T09:00:00Z') });
  await Payment.create({ id: 1, code: 'A', booking_id: 1, account_id: 7, type: 'ONLINE', method: 'MOMO', amount: 100000, status: 'PAID' });
  await Invoice.create({ id: 1, booking_id: 1, ticket_id: 1, account_id: 7, code: 'A', total_price: 100000, status: 1 });
}

describe('customerCrm.routes — /crm/me', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/crm/me');
    expect(res.status).toBe(401);
  });

  it('lets a customer read their own profile', async () => {
    await Account.create({ id: 7, email: 'c@x.com', password: 'h', name: 'Cus', points_balance: 10, lifetime_points: 10 });
    const res = await request(app).get('/api/crm/me').set('Authorization', authHeader({ role: 1, accountId: 7 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ customer_id: 7, scope: 'ALL', total_bookings: 0 });
  });
});

describe('customerCrm.routes — /crm/customers/:accountId', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/crm/customers/7');
    expect(res.status).toBe(401);
  });

  it('rejects a customer (no crm.viewCustomer)', async () => {
    await seedCustomer1AtBranch1();
    const res = await request(app)
      .get('/api/crm/customers/7')
      .set('Authorization', authHeader({ role: 1, accountId: 7 }));
    expect(res.status).toBe(403);
  });

  it('rejects a plain employee (crm.viewCustomer is not a default Employee permission)', async () => {
    await seedCustomer1AtBranch1();
    const res = await request(app)
      .get('/api/crm/customers/7')
      .set('Authorization', authHeader({ role: 3, accountId: 55 }));
    expect(res.status).toBe(403);
  });

  it('allows a super admin to read any customer', async () => {
    await seedCustomer1AtBranch1();
    const res = await request(app)
      .get('/api/crm/customers/7')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ customer_id: 7, scope: 'ALL', total_bookings: 1 });
    expect(res.body).toHaveProperty('favorite_genres');
  });

  it('allows a branch admin and scopes the profile to their branch', async () => {
    await seedCustomer1AtBranch1();
    const res = await request(app)
      .get('/api/crm/customers/7')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ customer_id: 7, scope: 'BRANCH', branch_ids: [1], total_bookings: 1 });
  });

  it('allows a Customer Service employee, with a redacted field set', async () => {
    await seedCustomer1AtBranch1();
    const cs = await Position.findOne({ code: 'CUSTOMER_SERVICE' });
    await Employee.create({ id: 1, user_id: 55, branch_id: 1, employee_code: 'E1', position_id: cs.id, status: 1 });
    const res = await request(app)
      .get('/api/crm/customers/7')
      .set('Authorization', authHeader({ role: 3, accountId: 55 }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ customer_id: 7, scope: 'BRANCH', branch_ids: [1] });
    expect(res.body).not.toHaveProperty('favorite_genres');
    expect(res.body).not.toHaveProperty('total_combo_spending');
  });

  it('404s a branch admin asking for a customer with no activity at their branch', async () => {
    await seedCustomer1AtBranch1();
    await Branch.create({ id: 2, company_id: 1, owner_id: 77, name: 'Other', code: 'B2' });
    const res = await request(app)
      .get('/api/crm/customers/7')
      .set('Authorization', authHeader({ role: 2, accountId: 77 }));
    expect(res.status).toBe(404);
  });

  it('never leaks password / token fields in the payload', async () => {
    await seedCustomer1AtBranch1();
    const res = await request(app)
      .get('/api/crm/customers/7')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(JSON.stringify(res.body)).not.toMatch(/password|refreshToken|"otp"/i);
  });
});
