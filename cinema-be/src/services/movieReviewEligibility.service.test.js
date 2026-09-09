const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieReviewEligibility = require('./movieReviewEligibility.service');
const Booking = require('../models/Booking');
const Schedule = require('../models/Schedule');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');

async function seedSchedule(overrides = {}) {
  return Schedule.create({
    id: 1,
    movie_id: 1,
    room_id: 1,
    movie_date: '2026-01-01',
    time_begin: '10:00',
    time_end: '12:00',
    price: 100,
    ...overrides,
  });
}

async function seedBooking(overrides = {}) {
  return Booking.create({
    id: 1,
    code: 'BK1',
    account_id: 1,
    schedule_id: 1,
    branch_id: 1,
    total_price: 100,
    status: 'PAID',
    ...overrides,
  });
}

async function seedInvoice(overrides = {}) {
  return Invoice.create({
    id: 1,
    booking_id: 1,
    ticket_id: 1,
    account_id: 1,
    code: 'BK1',
    total_price: 100,
    ticket_status: 'USED',
    ...overrides,
  });
}

// A booking is only "actually paid" once its linked Payment record (matched by Booking.code) is
// itself PAID — the service checks this in addition to Booking.status.
async function seedPayment(overrides = {}) {
  return Payment.create({
    id: 1,
    code: 'BK1',
    booking_id: 1,
    account_id: 1,
    type: 'ONLINE',
    method: 'CARD',
    amount: 100,
    status: 'PAID',
    ...overrides,
  });
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('checkEligibility', () => {
  it('fails with BOOKING_NOT_FOUND when the booking does not exist', async () => {
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 999 });
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 404, code: 'BOOKING_NOT_FOUND' }));
  });

  it('fails with BOOKING_NOT_OWNED when the booking belongs to someone else', async () => {
    await seedSchedule();
    await seedBooking({ account_id: 1 });
    await seedInvoice();
    await seedPayment();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 2, movieId: 1, bookingId: 1 });
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 403, code: 'BOOKING_NOT_OWNED' }));
  });

  it('fails with BOOKING_MOVIE_MISMATCH when the booking is for a different movie', async () => {
    await seedSchedule({ movie_id: 1 });
    await seedBooking();
    await seedInvoice();
    await seedPayment();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 2, bookingId: 1 });
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 400, code: 'BOOKING_MOVIE_MISMATCH' }));
  });

  it('fails with PAYMENT_NOT_CONFIRMED when the booking is still PENDING', async () => {
    await seedSchedule();
    await seedBooking({ status: 'PENDING' });
    await seedInvoice();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 1 });
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 403, code: 'PAYMENT_NOT_CONFIRMED' }));
  });

  it('fails with PAYMENT_NOT_CONFIRMED for a CANCELLED booking', async () => {
    await seedSchedule();
    await seedBooking({ status: 'CANCELLED' });
    await seedInvoice();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 1 });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('PAYMENT_NOT_CONFIRMED');
  });

  it('fails with PAYMENT_NOT_CONFIRMED when Booking.status is PAID but no Payment record exists', async () => {
    await seedSchedule();
    await seedBooking(); // status PAID, but no matching Payment doc seeded
    await seedInvoice();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 1 });
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 403, code: 'PAYMENT_NOT_CONFIRMED' }));
  });

  it('fails with PAYMENT_NOT_CONFIRMED when the linked Payment is not itself PAID (e.g. REFUND_PENDING)', async () => {
    await seedSchedule();
    await seedBooking();
    await seedInvoice();
    await seedPayment({ status: 'REFUND_PENDING' });
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 1 });
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 403, code: 'PAYMENT_NOT_CONFIRMED' }));
  });

  it('fails with TICKET_NOT_USED when no sibling invoice has been checked in', async () => {
    await seedSchedule();
    await seedBooking();
    await seedInvoice({ ticket_status: 'ISSUED' });
    await seedPayment();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 1 });
    expect(result).toEqual(expect.objectContaining({ ok: false, status: 403, code: 'TICKET_NOT_USED' }));
  });

  it('succeeds for a PAID booking with a confirmed Payment and a USED ticket', async () => {
    await seedSchedule();
    await seedBooking();
    await seedInvoice();
    await seedPayment();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 1 });
    expect(result.ok).toBe(true);
    expect(result.booking.id).toBe(1);
  });

  it('succeeds for a COMPLETED booking with a USED ticket', async () => {
    await seedSchedule();
    await seedBooking({ status: 'COMPLETED' });
    await seedInvoice();
    await seedPayment();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 1 });
    expect(result.ok).toBe(true);
  });

  it('succeeds when at least one of several invoices is USED', async () => {
    await seedSchedule();
    await seedBooking();
    await seedInvoice({ id: 1, ticket_id: 1, ticket_status: 'ISSUED' });
    await seedInvoice({ id: 2, ticket_id: 2, ticket_status: 'USED' });
    await seedPayment();
    const result = await movieReviewEligibility.checkEligibility({ accountId: 1, movieId: 1, bookingId: 1 });
    expect(result.ok).toBe(true);
  });
});

describe('findEligibleBookings', () => {
  it('returns an empty list when the movie has no schedules', async () => {
    expect(await movieReviewEligibility.findEligibleBookings(1, 999)).toEqual([]);
  });

  it('returns only bookings that are paid (with a confirmed Payment) and have a used ticket', async () => {
    await seedSchedule({ id: 1, movie_id: 1 });
    await seedSchedule({ id: 2, movie_id: 1 });
    await seedSchedule({ id: 3, movie_id: 1 });
    await seedBooking({ id: 1, code: 'BK1', schedule_id: 1, status: 'PAID' });
    await seedInvoice({ id: 1, booking_id: 1, ticket_status: 'USED' });
    await seedPayment({ id: 1, code: 'BK1', booking_id: 1 });
    // Booking 2: ticket not used yet.
    await seedBooking({ id: 2, code: 'BK2', schedule_id: 2, status: 'PAID' });
    await seedInvoice({ id: 2, booking_id: 2, ticket_status: 'ISSUED' });
    await seedPayment({ id: 2, code: 'BK2', booking_id: 2 });
    // Booking 3: ticket used, but no confirmed Payment record.
    await seedBooking({ id: 3, code: 'BK3', schedule_id: 3, status: 'PAID' });
    await seedInvoice({ id: 3, booking_id: 3, ticket_status: 'USED' });

    const eligible = await movieReviewEligibility.findEligibleBookings(1, 1);
    expect(eligible.map((b) => b.id)).toEqual([1]);
  });

  it('excludes another account\'s bookings', async () => {
    await seedSchedule();
    await seedBooking({ account_id: 2 });
    await seedInvoice();
    await seedPayment();
    expect(await movieReviewEligibility.findEligibleBookings(1, 1)).toEqual([]);
  });
});
