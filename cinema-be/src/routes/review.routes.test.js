const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const reviewRoutes = require('./review.routes');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Schedule = require('../models/Schedule');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');

const app = buildTestApp('/api/review', reviewRoutes);

async function seedEligibleBooking({ id = 1, accountId = 1, movieId = 1 } = {}) {
  await Schedule.create({
    id,
    movie_id: movieId,
    room_id: 1,
    movie_date: '2026-01-01',
    time_begin: '10:00',
    time_end: '12:00',
    price: 100,
  });
  await Booking.create({
    id,
    code: `BK${id}`,
    account_id: accountId,
    schedule_id: id,
    branch_id: 1,
    total_price: 100,
    status: 'PAID',
  });
  await Invoice.create({
    id,
    booking_id: id,
    ticket_id: id,
    account_id: accountId,
    code: `BK${id}`,
    total_price: 100,
    ticket_status: 'USED',
  });
  await Payment.create({
    id,
    code: `BK${id}`,
    booking_id: id,
    account_id: accountId,
    type: 'ONLINE',
    method: 'CARD',
    amount: 100,
    status: 'PAID',
  });
  return id;
}

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('review.routes wiring', () => {
  describe('GET /api/review (moderation list) — review.view, ALL scope', () => {
    it('401s with no token', async () => {
      const res = await request(app).get('/api/review');
      expect(res.status).toBe(401);
    });

    it('403s for a customer (review.view is only OWN scope for CUSTOMER)', async () => {
      const res = await request(app).get('/api/review').set('Authorization', authHeader({ role: 1 }));
      expect(res.status).toBe(403);
    });

    it('200s for a branch admin and an employee (both keep the pre-Ticket-33 ALL-scope grant)', async () => {
      const branchAdminRes = await request(app).get('/api/review').set('Authorization', authHeader({ role: 2 }));
      expect(branchAdminRes.status).toBe(200);
      const employeeRes = await request(app).get('/api/review').set('Authorization', authHeader({ role: 3 }));
      expect(employeeRes.status).toBe(200);
    });

    it('200s for a super admin', async () => {
      const res = await request(app).get('/api/review').set('Authorization', authHeader({ role: 0 }));
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/review/my — review.view, OWN scope', () => {
    it('401s with no token', async () => {
      const res = await request(app).get('/api/review/my');
      expect(res.status).toBe(401);
    });

    it('200s for a customer and returns only their own reviews', async () => {
      await Review.create([
        { id: 1, movie_id: 1, account_id: 1, rating: 5 },
        { id: 2, movie_id: 1, account_id: 2, rating: 3 },
      ]);
      const res = await request(app).get('/api/review/my').set('Authorization', authHeader({ accountId: 1, role: 1 }));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });
  });

  it('GET /api/review/:movieId works without auth (optionalAuth, public read)', async () => {
    const res = await request(app).get('/api/review/1');
    expect(res.status).toBe(200);
  });

  it('GET /api/review/cinema/:branchId works without auth (optionalAuth, public read)', async () => {
    const res = await request(app).get('/api/review/cinema/1');
    expect(res.status).toBe(200);
  });

  describe('GET /api/review/movie/:movieId/eligible-bookings', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/review/movie/1/eligible-bookings');
      expect(res.status).toBe(401);
    });

    it('returns the caller\'s eligible bookings for a movie', async () => {
      await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
      const res = await request(app)
        .get('/api/review/movie/1/eligible-bookings')
        .set('Authorization', authHeader({ accountId: 1, role: 1 }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([expect.objectContaining({ booking_id: 1 })]);
    });
  });

  describe('POST /api/review — review.create', () => {
    it('requires auth', async () => {
      const res = await request(app).post('/api/review').send({ movie_id: 1, booking_id: 1, rating: 5 });
      expect(res.status).toBe(401);
    });

    it('403s for an employee (not granted review.create)', async () => {
      const res = await request(app)
        .post('/api/review')
        .set('Authorization', authHeader({ role: 3 }))
        .send({ cinema_id: 1, rating: 5 });
      expect(res.status).toBe(403);
    });

    it('a customer can post a cinema review with no purchase verification', async () => {
      const res = await request(app)
        .post('/api/review')
        .set('Authorization', authHeader({ accountId: 1, role: 1 }))
        .send({ cinema_id: 1, rating: 5 });
      expect(res.status).toBe(201);
    });

    it('rejects a movie review with no booking_id', async () => {
      const res = await request(app)
        .post('/api/review')
        .set('Authorization', authHeader({ accountId: 1, role: 1 }))
        .send({ movie_id: 1, rating: 5 });
      expect(res.status).toBe(400);
    });

    it('rejects a movie review when the caller has no eligible booking', async () => {
      const res = await request(app)
        .post('/api/review')
        .set('Authorization', authHeader({ accountId: 1, role: 1 }))
        .send({ movie_id: 1, booking_id: 999, rating: 5 });
      expect(res.status).toBe(404);
    });

    it('creates a movie review for a customer with a verified booking (Ticket 33)', async () => {
      await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
      const res = await request(app)
        .post('/api/review')
        .set('Authorization', authHeader({ accountId: 1, role: 1 }))
        .send({ movie_id: 1, booking_id: 1, rating: 5, comment: 'Loved it' });
      expect(res.status).toBe(201);
      expect(res.body.booking_id).toBe(1);
    });

    it('a super admin also has review.create (blanket grant)', async () => {
      const res = await request(app)
        .post('/api/review')
        .set('Authorization', authHeader({ accountId: 1, role: 0 }))
        .send({ cinema_id: 1, rating: 5 });
      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/review/:id — review.update_own', () => {
    it('403s for an employee (not granted review.update_own)', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app)
        .put('/api/review/1')
        .set('Authorization', authHeader({ role: 3 }))
        .send({ rating: 3 });
      expect(res.status).toBe(403);
    });

    it('forbids a customer editing someone else\'s review', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app)
        .put('/api/review/1')
        .set('Authorization', authHeader({ accountId: 2, role: 1 }))
        .send({ rating: 3 });
      expect(res.status).toBe(403);
    });

    it('allows the author (customer) to edit their own review', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app)
        .put('/api/review/1')
        .set('Authorization', authHeader({ accountId: 1, role: 1 }))
        .send({ rating: 3, comment: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.rating).toBe(3);
    });

    it('allows a super admin to edit any review (ALL scope)', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app)
        .put('/api/review/1')
        .set('Authorization', authHeader({ accountId: 99, role: 0 }))
        .send({ rating: 1, comment: 'Moderated edit' });
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/review/:id — review.delete_own', () => {
    it('403s for an employee (not granted review.delete_own)', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app).delete('/api/review/1').set('Authorization', authHeader({ role: 3 }));
      expect(res.status).toBe(403);
    });

    it('forbids a customer deleting someone else\'s review', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app)
        .delete('/api/review/1')
        .set('Authorization', authHeader({ accountId: 2, role: 1 }));
      expect(res.status).toBe(403);
    });

    it('allows the author (customer) to delete their own review', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app)
        .delete('/api/review/1')
        .set('Authorization', authHeader({ accountId: 1, role: 1 }));
      expect(res.status).toBe(200);
      expect(await Review.countDocuments()).toBe(0);
    });

    it('allows a super admin to delete any review (ALL scope)', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app)
        .delete('/api/review/1')
        .set('Authorization', authHeader({ accountId: 99, role: 0 }));
      expect(res.status).toBe(200);
    });
  });

  describe('moderation actions — review.moderate', () => {
    it('PUT /api/review/:id/hide requires review.moderate (customer forbidden)', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app).put('/api/review/1/hide').set('Authorization', authHeader({ role: 1 }));
      expect(res.status).toBe(403);
    });

    it('PUT /api/review/:id/hide requires review.moderate (branch admin forbidden)', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app).put('/api/review/1/hide').set('Authorization', authHeader({ role: 2 }));
      expect(res.status).toBe(403);
    });

    it('a super admin can hide a review', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app).put('/api/review/1/hide').set('Authorization', authHeader({ role: 0 }));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('HIDDEN');
    });

    it('a super admin can reject a review', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app).put('/api/review/1/reject').set('Authorization', authHeader({ role: 0 }));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REJECTED');
    });

    it('POST /api/review/:id/reject as a customer is forbidden', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = await request(app).put('/api/review/1/reject').set('Authorization', authHeader({ role: 1 }));
      expect(res.status).toBe(403);
    });

    it('a super admin can restore a hidden review', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5, status: 'HIDDEN' });
      const res = await request(app).put('/api/review/1/restore').set('Authorization', authHeader({ role: 0 }));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VISIBLE');
    });
  });
});
