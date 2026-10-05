jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed
jest.mock('../utils/mailer', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({}),
  sendNotificationEmail: jest.fn().mockResolvedValue({ messageId: 'x' }),
}));

const express = require('express');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const { ID, customer, seedSoldOutShowtime, soldBooking } = require('../../tests/waitlistFixtures');
const { errorHandler } = require('../middleware/errorHandler');
const seedRbac = require('../seed/seedRbac');
const waitlistRoutes = require('./waitlist.routes');
const bookingRepository = require('../repositories/booking.repository');
const systemConfigService = require('../services/systemConfig.service');
const Notification = require('../models/Notification');
const Waitlist = require('../models/Waitlist');
const WaitlistLock = require('../models/WaitlistLock');

const app = express();
app.use(express.json());
app.use('/api/waitlist', waitlistRoutes);
app.use(errorHandler);

const as = (role, accountId) => authHeader({ role, accountId });
const customerAuth = (n) => as(1, customer(n));

beforeAll(async () => {
  await connect();
  await Promise.all([Waitlist.init(), WaitlistLock.init(), Notification.init()]);
});
beforeEach(async () => {
  systemConfigService.invalidateAll();
  await seedRbac();
  await seedSoldOutShowtime();
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

const joinAs = (n, body = { schedule_id: ID.SHOWTIME }) =>
  request(app).post('/api/waitlist').set('Authorization', customerAuth(n)).send(body);

describe('who may use the waitlist', () => {
  it('requires a login', async () => {
    expect((await request(app).get('/api/waitlist')).status).toBe(401);
    expect((await request(app).post('/api/waitlist').send({ schedule_id: ID.SHOWTIME })).status).toBe(401);
  });

  it.each([
    ['a Branch Admin', 2],
    ['an Employee', 3],
  ])('is not for %s', async (_label, role) => {
    const res = await request(app).post('/api/waitlist').set('Authorization', as(role, 77)).send({ schedule_id: ID.SHOWTIME });
    expect(res.status).toBe(403);
    expect((await request(app).get('/api/waitlist').set('Authorization', as(role, 77))).status).toBe(403);
  });
});

describe('POST /api/waitlist', () => {
  it('queues the caller for a sold-out showtime', async () => {
    const res = await joinAs(0, { schedule_id: ID.SHOWTIME, seat_count: 2 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'WAITING', seat_count: 2, position: 1, schedule_id: ID.SHOWTIME });
    expect(res.body).not.toHaveProperty('account_id');
  });

  it('answers a duplicate with 409 and the existing entry', async () => {
    const first = await joinAs(0);
    const res = await joinAs(0);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'WAITLIST_DUPLICATE', entry: { id: first.body.id } });
  });

  it('refuses to queue someone else', async () => {
    const res = await joinAs(0, { schedule_id: ID.SHOWTIME, account_id: customer(1) });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'WAITLIST_FIELD_NOT_ALLOWED', fields: ['account_id'] });
    expect(await Waitlist.countDocuments()).toBe(0);
  });

  it('sends a customer with seats still on sale to book them', async () => {
    await bookingRepository.updateTicketStatus(1, 1);
    const res = await joinAs(0);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'SHOWTIME_NOT_FULL', available_seats: 1 });
  });
});

describe('reading and leaving', () => {
  it("lists only the caller's own entries", async () => {
    await joinAs(0);
    await joinAs(1);
    const res = await request(app).get('/api/waitlist').set('Authorization', customerAuth(1));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, page: 1 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ position: 2, movie: { name: 'Dune: Part Three' } });
  });

  it('filters by status', async () => {
    const mine = await joinAs(0);
    await request(app).post(`/api/waitlist/${mine.body.id}/cancel`).set('Authorization', customerAuth(0));
    await joinAs(0);
    const res = await request(app).get('/api/waitlist?status=cancelled').set('Authorization', customerAuth(0));
    expect(res.body.data.map((e) => e.status)).toEqual(['CANCELLED']);
  });

  it("answers 404 for someone else's entry, whether reading or cancelling it", async () => {
    const theirs = await joinAs(1);
    const read = await request(app).get(`/api/waitlist/${theirs.body.id}`).set('Authorization', customerAuth(0));
    const cancel = await request(app).post(`/api/waitlist/${theirs.body.id}/cancel`).set('Authorization', customerAuth(0));
    expect(read.status).toBe(404);
    expect(cancel.status).toBe(404);
    expect(read.body.code).toBe('WAITLIST_NOT_FOUND');
    expect((await Waitlist.findOne({ id: theirs.body.id })).status).toBe('WAITING');
  });

  it('lets the caller leave the queue', async () => {
    const mine = await joinAs(0);
    const res = await request(app).post(`/api/waitlist/${mine.body.id}/cancel`).set('Authorization', customerAuth(0));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CANCELLED', close_reason: 'CUSTOMER_CANCELLED' });
  });
});

describe('GET /api/waitlist/showtimes/:scheduleId', () => {
  it("reports the showtime and the caller's own place in it", async () => {
    await joinAs(0);
    await joinAs(1);
    const res = await request(app).get(`/api/waitlist/showtimes/${ID.SHOWTIME}`).set('Authorization', customerAuth(1));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ full: true, waiting_count: 2, can_join: false, reason: { code: 'WAITLIST_DUPLICATE' } });
    expect(res.body.entry).toMatchObject({ position: 2 });
  });

  it('answers 404 for an unknown showtime', async () => {
    const res = await request(app).get('/api/waitlist/showtimes/404').set('Authorization', customerAuth(0));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('SHOWTIME_NOT_FOUND');
  });
});

describe('the flow end to end', () => {
  it('join -> seat freed -> notified -> customer sees the offer', async () => {
    const mine = await joinAs(0);
    await bookingRepository.cancelBooking(await soldBooking(2));

    const res = await request(app).get(`/api/waitlist/${mine.body.id}`).set('Authorization', customerAuth(0));
    expect(res.body).toMatchObject({ status: 'NOTIFIED', offered_seat_codes: ['A2'], position: null });
    expect(new Date(res.body.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(await Notification.countDocuments({ account_id: customer(0), type: 'WAITLIST_SEAT_AVAILABLE' })).toBe(1);
  });
});
