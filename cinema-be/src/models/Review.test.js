const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Review = require('./Review');

beforeAll(async () => {
  await connect();
  await Review.init(); // ensure the partial unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Review model', () => {
  it('creates a valid review and applies defaults', async () => {
    const review = await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    expect(review.cinema_id).toBeNull();
    expect(review.parent_id).toBeNull();
    expect(review.comment).toBe('');
    expect(review.hidden).toBe(false);
    expect(review.reactions).toEqual([]);
    expect(review.reports).toEqual([]);
    expect(review.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Review({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.account_id).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    await expect(Review.create({ id: 1, movie_id: 2, account_id: 2, rating: 4 })).rejects.toThrow();
  });

  it('rejects a rating outside the 1-5 range', () => {
    const review = new Review({ id: 1, movie_id: 1, account_id: 1, rating: 6 });
    const err = review.validateSync();
    expect(err.errors.rating).toBeDefined();

    const tooLow = new Review({ id: 2, movie_id: 1, account_id: 1, rating: 0 });
    expect(tooLow.validateSync().errors.rating).toBeDefined();
  });

  it('allows only one top-level review per account per movie', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    await expect(Review.create({ id: 2, movie_id: 1, account_id: 1, rating: 4 })).rejects.toThrow();
  });

  it('allows only one top-level review per account per cinema', async () => {
    await Review.create({ id: 1, cinema_id: 1, account_id: 1, rating: 5 });
    await expect(Review.create({ id: 2, cinema_id: 1, account_id: 1, rating: 4 })).rejects.toThrow();
  });

  it('allows multiple replies (parent_id set) from the same account to the same movie', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    await Review.create({ id: 2, movie_id: 1, account_id: 1, parent_id: 1, comment: 'reply 1' });
    await expect(
      Review.create({ id: 3, movie_id: 1, account_id: 1, parent_id: 1, comment: 'reply 2' }),
    ).resolves.toBeDefined();
  });

  it('stores embedded reactions and reports with required fields', async () => {
    const review = await Review.create({
      id: 1,
      movie_id: 1,
      account_id: 1,
      rating: 5,
      reactions: [{ account_id: 2, type: 'love' }],
      reports: [{ account_id: 3, reason: 'spam' }],
    });
    expect(review.reactions).toHaveLength(1);
    expect(review.reactions[0].type).toBe('love');
    expect(review.reactions[0]._id).toBeUndefined();
    expect(review.reports[0].reason).toBe('spam');
  });

  it('rejects a reaction type outside the enum', () => {
    const review = new Review({
      id: 1,
      movie_id: 1,
      account_id: 1,
      reactions: [{ account_id: 2, type: 'invalid' }],
    });
    const err = review.validateSync();
    expect(err.errors['reactions.0.type']).toBeDefined();
  });

  it('toJSON strips _id and __v', async () => {
    const review = await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const json = review.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
