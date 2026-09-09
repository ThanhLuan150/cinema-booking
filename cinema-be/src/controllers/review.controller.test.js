const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const reviewController = require('./review.controller');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Schedule = require('../models/Schedule');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

async function seedEligibleBooking({
  id = 1,
  accountId = 1,
  movieId = 1,
  bookingStatus = 'PAID',
  ticketStatus = 'USED',
  paymentStatus = 'PAID',
  skipPayment = false,
} = {}) {
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
    status: bookingStatus,
  });
  await Invoice.create({
    id,
    booking_id: id,
    ticket_id: id,
    account_id: accountId,
    code: `BK${id}`,
    total_price: 100,
    ticket_status: ticketStatus,
  });
  if (!skipPayment) {
    await Payment.create({
      id,
      code: `BK${id}`,
      booking_id: id,
      account_id: accountId,
      type: 'ONLINE',
      method: 'CARD',
      amount: 100,
      status: paymentStatus,
    });
  }
  return id;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('listForModeration / listOwn / listForMovie / listForCinema', () => {
  it('listForModeration paginates all reviews for an ALL-scope caller', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.listForModeration({ query: {}, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('listForModeration filters by status and movieId', async () => {
    await Review.create([
      { id: 1, movie_id: 1, account_id: 1, rating: 5, status: 'HIDDEN' },
      { id: 2, movie_id: 1, account_id: 2, rating: 4 },
    ]);
    const res = mockRes();
    await reviewController.listForModeration({ query: { status: 'HIDDEN' }, permissionScope: 'ALL' }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('listForModeration forbids a non-ALL scope caller', async () => {
    const res = mockRes();
    await reviewController.listForModeration({ query: {}, permissionScope: 'OWN' }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('listOwn returns only the caller\'s own top-level reviews', async () => {
    await Review.create([
      { id: 1, movie_id: 1, account_id: 42, rating: 5 },
      { id: 2, movie_id: 1, account_id: 99, rating: 3 },
    ]);
    const res = mockRes();
    await reviewController.listOwn({ query: {}, account: { accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('listForMovie returns the threaded result', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.listForMovie({ params: { movieId: 1 }, account: null }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });

  it('listForCinema returns the threaded result', async () => {
    await Review.create({ id: 1, cinema_id: 1, account_id: 1, rating: 4 });
    const res = mockRes();
    await reviewController.listForCinema({ params: { branchId: 1 }, account: null }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });
});

describe('listEligibleBookings', () => {
  it('lists a paid+used booking not yet reviewed', async () => {
    await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
    const res = mockRes();
    await reviewController.listEligibleBookings({ params: { movieId: 1 }, account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ booking_id: 1 })]);
  });

  it('excludes a booking that was already reviewed', async () => {
    await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
    await Review.create({ id: 1, movie_id: 1, account_id: 1, booking_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.listEligibleBookings({ params: { movieId: 1 }, account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('excludes a booking whose ticket has not been used', async () => {
    await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1, ticketStatus: 'ISSUED' });
    const res = mockRes();
    await reviewController.listEligibleBookings({ params: { movieId: 1 }, account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('create', () => {
  it('rejects providing both movie_id and cinema_id', async () => {
    const res = mockRes();
    await reviewController.create({ body: { movie_id: 1, cinema_id: 1, rating: 5 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects providing neither movie_id nor cinema_id', async () => {
    const res = mockRes();
    await reviewController.create({ body: { rating: 5 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a missing rating for a top-level review', async () => {
    const res = mockRes();
    await reviewController.create({ body: { movie_id: 1 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an out-of-range rating', async () => {
    const res = mockRes();
    await reviewController.create({ body: { movie_id: 1, rating: 6 }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a non-numeric rating (e.g. "abc") instead of silently accepting it', async () => {
    const res = mockRes();
    await reviewController.create({ body: { cinema_id: 1, rating: 'abc' }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(await Review.countDocuments()).toBe(0);
  });

  describe('cinema reviews (no purchase verification)', () => {
    it('creates a new top-level cinema review', async () => {
      const res = mockRes();
      await reviewController.create({ body: { cinema_id: 1, rating: 5, comment: 'Great' }, account: { accountId: 42 } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(await Review.countDocuments()).toBe(1);
    });

    it('updates the caller\'s existing top-level cinema review instead of duplicating', async () => {
      await Review.create({ id: 1, cinema_id: 1, account_id: 42, rating: 3, comment: 'Ok' });
      const res = mockRes();
      await reviewController.create({ body: { cinema_id: 1, rating: 5, comment: 'Better' }, account: { accountId: 42 } }, res);
      expect(await Review.countDocuments()).toBe(1);
      expect((await Review.findOne({ id: 1 })).rating).toBe(5);
    });
  });

  describe('movie reviews (Ticket 33 purchase verification)', () => {
    it('rejects a movie review with no booking_id', async () => {
      const res = mockRes();
      await reviewController.create({ body: { movie_id: 1, rating: 5 }, account: { accountId: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(await Review.countDocuments()).toBe(0);
    });

    it('rejects when the booking does not exist', async () => {
      const res = mockRes();
      await reviewController.create({ body: { movie_id: 1, booking_id: 999, rating: 5 }, account: { accountId: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects when the booking belongs to someone else', async () => {
      const bookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: bookingId, rating: 5 }, account: { accountId: 2 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('rejects when the booking is for a different movie', async () => {
      const bookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 2, booking_id: bookingId, rating: 5 }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects when the booking has not been paid', async () => {
      const bookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1, bookingStatus: 'PENDING' });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: bookingId, rating: 5 }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(await Review.countDocuments()).toBe(0);
    });

    it('rejects when Booking.status is PAID but there is no confirmed Payment record', async () => {
      const bookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1, skipPayment: true });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: bookingId, rating: 5 }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(await Review.countDocuments()).toBe(0);
    });

    it('rejects when the ticket has not been used yet', async () => {
      const bookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1, ticketStatus: 'ISSUED' });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: bookingId, rating: 5 }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
      expect(await Review.countDocuments()).toBe(0);
    });

    it('creates a review for a PAID booking with a USED ticket', async () => {
      const bookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: bookingId, rating: 5, comment: 'Great movie' }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const review = await Review.findOne({ booking_id: bookingId });
      expect(review.account_id).toBe(1);
      expect(review.rating).toBe(5);
    });

    it('also accepts a COMPLETED booking (fully checked in)', async () => {
      const bookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1, bookingStatus: 'COMPLETED' });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: bookingId, rating: 4 }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('rejects a second review for the same booking (one review per booking)', async () => {
      const bookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
      await Review.create({ id: 1, movie_id: 1, account_id: 1, booking_id: bookingId, rating: 5 });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: bookingId, rating: 3 }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(409);
      expect(await Review.countDocuments()).toBe(1);
    });

    it('allows a second, separate review from a different booking of the same movie', async () => {
      const firstBookingId = await seedEligibleBooking({ id: 1, accountId: 1, movieId: 1 });
      const firstRes = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: firstBookingId, rating: 5 }, account: { accountId: 1 } },
        firstRes,
      );
      expect(firstRes.status).toHaveBeenCalledWith(201);

      const secondBookingId = await seedEligibleBooking({ id: 2, accountId: 1, movieId: 1 });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, booking_id: secondBookingId, rating: 2 }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(await Review.countDocuments()).toBe(2);
    });
  });

  describe('replies', () => {
    it('rejects a reply to a non-existent parent', async () => {
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, parent_id: 999, comment: 'Hi' }, account: { accountId: 1 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a reply to a hidden parent', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5, status: 'HIDDEN' });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, parent_id: 1, comment: 'Hi' }, account: { accountId: 2 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a reply to a rejected parent', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5, status: 'REJECTED' });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, parent_id: 1, comment: 'Hi' }, account: { accountId: 2 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects a reply where parent_id does not match the target', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 2, parent_id: 1, comment: 'Hi' }, account: { accountId: 2 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects a reply with an empty comment', async () => {
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, parent_id: 1, comment: '  ' }, account: { accountId: 2 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates a reply with a null rating', async () => {
      await Review.create({ id: 100, movie_id: 1, account_id: 1, rating: 5 });
      const res = mockRes();
      await reviewController.create(
        { body: { movie_id: 1, parent_id: 100, comment: 'Nice!' }, account: { accountId: 2 } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const reply = await Review.findOne({ parent_id: 100 });
      expect(reply.rating).toBeNull();
    });
  });
});

describe('update', () => {
  it('returns 404 for an unknown review', async () => {
    const res = mockRes();
    await reviewController.update({ params: { id: 999 }, body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids editing someone else\'s review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.update({ params: { id: 1 }, body: { rating: 3 }, account: { accountId: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows an ALL-scope caller (Super Admin) to edit any review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.update(
      { params: { id: 1 }, body: { rating: 2, comment: 'edited by admin' }, account: { accountId: 2 }, permissionScope: 'ALL' },
      res,
    );
    expect((await Review.findOne({ id: 1 })).rating).toBe(2);
  });

  it('requires a valid rating for a top-level review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.update({ params: { id: 1 }, body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a non-numeric rating on update', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.update({ params: { id: 1 }, body: { rating: 'abc' }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates a top-level review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.update({ params: { id: 1 }, body: { rating: 2, comment: 'Changed' }, account: { accountId: 1 } }, res);
    expect((await Review.findOne({ id: 1 })).rating).toBe(2);
  });

  it('requires a non-empty comment for a reply and forces rating to null', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, parent_id: 5, rating: null, comment: 'Old' });
    const res = mockRes();
    await reviewController.update({ params: { id: 1 }, body: { comment: '' }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await reviewController.update({ params: { id: 1 }, body: { rating: 5, comment: 'New reply' }, account: { accountId: 1 } }, res2);
    const updated = await Review.findOne({ id: 1 });
    expect(updated.rating).toBeNull();
    expect(updated.comment).toBe('New reply');
  });
});

describe('report', () => {
  it('rejects a missing reason', async () => {
    const res = mockRes();
    await reviewController.report({ params: { id: 1 }, body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for an unknown review', async () => {
    const res = mockRes();
    await reviewController.report({ params: { id: 999 }, body: { reason: 'spam' }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects reporting your own review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 42, rating: 5 });
    const res = mockRes();
    await reviewController.report({ params: { id: 1 }, body: { reason: 'spam' }, account: { accountId: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('reports someone else\'s review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.report({ params: { id: 1 }, body: { reason: 'spam' }, account: { accountId: 2 } }, res);
    expect((await Review.findOne({ id: 1 })).reports).toHaveLength(1);
  });
});

describe('react', () => {
  it('rejects an invalid reaction type', async () => {
    const res = mockRes();
    await reviewController.react({ params: { id: 1 }, body: { type: 'nope' }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for an unknown review', async () => {
    const res = mockRes();
    await reviewController.react({ params: { id: 999 }, body: { type: 'like' }, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('toggles a reaction', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.react({ params: { id: 1 }, body: { type: 'like' }, account: { accountId: 2 } }, res);
    expect((await Review.findOne({ id: 1 })).reactions).toHaveLength(1);
  });
});

describe('hide / reject / restore', () => {
  it('hide returns 404 for an unknown review', async () => {
    const res = mockRes();
    await reviewController.hide({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('hide sets the review status to HIDDEN', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.hide({ params: { id: 1 } }, res);
    expect((await Review.findOne({ id: 1 })).status).toBe('HIDDEN');
  });

  it('reject sets the review status to REJECTED', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.reject({ params: { id: 1 } }, res);
    expect((await Review.findOne({ id: 1 })).status).toBe('REJECTED');
  });

  it('restore sets the review status back to VISIBLE', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5, status: 'HIDDEN' });
    const res = mockRes();
    await reviewController.restore({ params: { id: 1 } }, res);
    expect((await Review.findOne({ id: 1 })).status).toBe('VISIBLE');
  });
});

describe('remove', () => {
  it('returns 404 for an unknown review', async () => {
    const res = mockRes();
    await reviewController.remove({ params: { id: 999 }, account: { accountId: 99 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids removing someone else\'s review as a non-admin', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.remove({ params: { id: 1 }, account: { accountId: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows an ALL-scope caller (Super Admin) to remove any review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.remove({ params: { id: 1 }, account: { accountId: 99 }, permissionScope: 'ALL' }, res);
    expect(await Review.countDocuments()).toBe(0);
  });

  it('allows the author to remove their own review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.remove({ params: { id: 1 }, account: { accountId: 1 } }, res);
    expect(await Review.countDocuments()).toBe(0);
  });
});
