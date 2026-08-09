const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const reviewController = require('./review.controller');
const Review = require('../models/Review');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('listForModeration / listForMovie / listForCinema', () => {
  it('listForModeration paginates all reviews', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.listForModeration({ query: {} }, res);
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

  it('creates a new top-level review', async () => {
    const res = mockRes();
    await reviewController.create({ body: { movie_id: 1, rating: 5, comment: 'Great' }, account: { accountId: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(await Review.countDocuments()).toBe(1);
  });

  it('updates the caller\'s existing top-level review instead of duplicating', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 42, rating: 3, comment: 'Ok' });
    const res = mockRes();
    await reviewController.create({ body: { movie_id: 1, rating: 5, comment: 'Better' }, account: { accountId: 42 } }, res);
    expect(await Review.countDocuments()).toBe(1);
    expect((await Review.findOne({ id: 1 })).rating).toBe(5);
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
      await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5, hidden: true });
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

  it('requires a valid rating for a top-level review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.update({ params: { id: 1 }, body: {}, account: { accountId: 1 } }, res);
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

describe('hide', () => {
  it('returns 404 for an unknown review', async () => {
    const res = mockRes();
    await reviewController.hide({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('hides the review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.hide({ params: { id: 1 } }, res);
    expect((await Review.findOne({ id: 1 })).hidden).toBe(true);
  });
});

describe('remove', () => {
  it('returns 404 for an unknown review', async () => {
    const res = mockRes();
    await reviewController.remove({ params: { id: 999 }, account: { role: 0 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('forbids removing someone else\'s review as a non-admin', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.remove({ params: { id: 1 }, account: { role: 1, accountId: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows an admin to remove any review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.remove({ params: { id: 1 }, account: { role: 0, accountId: 99 } }, res);
    expect(await Review.countDocuments()).toBe(0);
  });

  it('allows the author to remove their own review', async () => {
    await Review.create({ id: 1, movie_id: 1, account_id: 1, rating: 5 });
    const res = mockRes();
    await reviewController.remove({ params: { id: 1 }, account: { role: 1, accountId: 1 } }, res);
    expect(await Review.countDocuments()).toBe(0);
  });
});
