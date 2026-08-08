const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const reviewRepository = require('./review.repository');
const Review = require('../models/Review');
const Movie = require('../models/Movie');
const Cinema = require('../models/Cinema');
const Account = require('../models/Account');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('review.repository', () => {
  describe('findVisibleByMovieId / buildThread', () => {
    it('threads replies under their parent review and computes the average rating', async () => {
      await Account.create([
        { id: 1, email: 'a@b.com', password: 'x', name: 'Alice' },
        { id: 2, email: 'c@d.com', password: 'x', name: 'Bob' },
      ]);
      await Review.create([
        { id: 1, movie_id: 10, account_id: 1, rating: 4, comment: 'Great!' },
        { id: 2, movie_id: 10, account_id: 2, rating: 2, comment: 'Meh' },
        { id: 3, movie_id: 10, account_id: 2, parent_id: 1, comment: 'Agreed' },
      ]);

      const result = await reviewRepository.findVisibleByMovieId(10, 2);
      expect(result.count).toBe(2);
      expect(result.average).toBe(3);
      const withReply = result.reviews.find((r) => r.id === 1);
      expect(withReply.replies).toHaveLength(1);
      expect(withReply.replies[0].author.name).toBe('Bob');
      expect(withReply.author.name).toBe('Alice');
    });

    it('excludes hidden reviews', async () => {
      await Review.create({ id: 1, movie_id: 10, account_id: 1, rating: 5, hidden: true });
      const result = await reviewRepository.findVisibleByMovieId(10, null);
      expect(result.count).toBe(0);
    });

    it('summarizes reactions and flags the viewer\'s own reaction/report', async () => {
      await Review.create({
        id: 1,
        movie_id: 10,
        account_id: 1,
        rating: 5,
        reactions: [
          { account_id: 1, type: 'like' },
          { account_id: 2, type: 'like' },
          { account_id: 3, type: 'love' },
        ],
        reports: [{ account_id: 2, reason: 'spam' }],
      });

      const result = await reviewRepository.findVisibleByMovieId(10, 2);
      const review = result.reviews[0];
      expect(review.reactions.counts).toEqual({ like: 2, love: 1 });
      expect(review.reactions.total).toBe(3);
      expect(review.reactions.mine).toBe('like');
      expect(review.reportedByMe).toBe(true);
      expect(review.reports).toBeUndefined();
    });
  });

  it('findVisibleBybranchId scopes to a cinema id', async () => {
    await Review.create([
      { id: 1, cinema_id: 5, account_id: 1, rating: 5 },
      { id: 2, cinema_id: 6, account_id: 1, rating: 3 },
    ]);
    const result = await reviewRepository.findVisibleBybranchId(5, null);
    expect(result.count).toBe(1);
  });

  it('findOwn finds the caller\'s own top-level review for a target', async () => {
    await Review.create({ id: 1, movie_id: 10, account_id: 42, rating: 5 });
    const found = await reviewRepository.findOwn({ movie_id: 10 }, 42);
    expect(found).not.toBeNull();
    const notFound = await reviewRepository.findOwn({ movie_id: 10 }, 99);
    expect(notFound).toBeNull();
  });

  it('create persists a new review', async () => {
    const review = await reviewRepository.create({ id: 1, movie_id: 10, account_id: 1, rating: 5 });
    expect(review.id).toBe(1);
  });

  it('saveExisting updates rating and comment on an existing review', async () => {
    const review = await Review.create({ id: 1, movie_id: 10, account_id: 1, rating: 3, comment: 'Ok' });
    const updated = await reviewRepository.saveExisting(review, { rating: 5, comment: 'Better now' });
    expect(updated.rating).toBe(5);
    expect(updated.comment).toBe('Better now');
  });

  it('hide sets hidden to true', async () => {
    await Review.create({ id: 1, movie_id: 10, account_id: 1, rating: 5 });
    const hidden = await reviewRepository.hide(1);
    expect(hidden.hidden).toBe(true);
  });

  it('findById and remove manage a single review', async () => {
    await Review.create({ id: 1, movie_id: 10, account_id: 1, rating: 5 });
    expect(await reviewRepository.findById(1)).not.toBeNull();
    await reviewRepository.remove(1);
    expect(await Review.countDocuments()).toBe(0);
  });

  describe('react', () => {
    it('adds a reaction when the caller has none yet', async () => {
      await Review.create({ id: 1, movie_id: 10, account_id: 1, rating: 5 });
      const updated = await reviewRepository.react(1, 42, 'like');
      expect(updated.reactions).toHaveLength(1);
    });

    it('replaces the reaction type when the caller reacts again differently', async () => {
      await Review.create({ id: 1, movie_id: 10, account_id: 1, rating: 5, reactions: [{ account_id: 42, type: 'like' }] });
      const updated = await reviewRepository.react(1, 42, 'love');
      expect(updated.reactions).toHaveLength(1);
      expect(updated.reactions[0].type).toBe('love');
    });

    it('removes the reaction when the same type is sent again', async () => {
      await Review.create({ id: 1, movie_id: 10, account_id: 1, rating: 5, reactions: [{ account_id: 42, type: 'like' }] });
      const updated = await reviewRepository.react(1, 42, 'like');
      expect(updated.reactions).toHaveLength(0);
    });

    it('returns null for a non-existent review', async () => {
      expect(await reviewRepository.react(999, 1, 'like')).toBeNull();
    });
  });

  describe('report', () => {
    it('adds a report from a new reporter', async () => {
      await Review.create({ id: 1, movie_id: 10, account_id: 1, rating: 5 });
      const updated = await reviewRepository.report(1, 42, 'spam');
      expect(updated.reports).toHaveLength(1);
    });

    it('replaces the reason for a repeat reporter instead of duplicating', async () => {
      await Review.create({
        id: 1,
        movie_id: 10,
        account_id: 1,
        rating: 5,
        reports: [{ account_id: 42, reason: 'old reason' }],
      });
      const updated = await reviewRepository.report(1, 42, 'new reason');
      expect(updated.reports).toHaveLength(1);
      expect(updated.reports[0].reason).toBe('new reason');
    });
  });

  describe('findAllForModeration', () => {
    it('includes movie/cinema names and report counts, including hidden reviews', async () => {
      await Movie.create({ id: 10, name: 'Movie X', premiere_date: '2026-01-01' });
      await Cinema.create({ id: 20, owner_id: 1, name: 'Cinema Y' });
      await Review.create([
        { id: 1, movie_id: 10, account_id: 1, rating: 5, hidden: true, reports: [{ account_id: 2, reason: 'x' }] },
        { id: 2, cinema_id: 20, account_id: 1, rating: 4 },
      ]);

      const result = await reviewRepository.findAllForModeration({ skip: 0, limit: 20 });
      expect(result.total).toBe(2);
      const movieReview = result.data.find((r) => r.id === 1);
      expect(movieReview.movie).toEqual({ name: 'Movie X' });
      expect(movieReview.reportCount).toBe(1);
      const cinemaReview = result.data.find((r) => r.id === 2);
      expect(cinemaReview.cinema).toEqual({ name: 'Cinema Y' });
    });
  });
});
