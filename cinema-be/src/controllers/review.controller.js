const reviewRepository = require('../repositories/review.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

// GET /api/review?page=&limit= -> all reviews including hidden ones, joined with movie/cinema name (admin only — moderation)
async function listForModeration(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await reviewRepository.findAllForModeration({ skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/review/cinema/:branchId -> visible reviews (threaded with replies) for a cinema + average rating
async function listForCinema(req, res) {
  const result = await reviewRepository.findVisibleByCinemaId(req.params.branchId, req.account?.accountId);
  res.json(result);
}

// GET /api/review/:movieId -> visible reviews (threaded with replies) for a movie + average rating
async function listForMovie(req, res) {
  const result = await reviewRepository.findVisibleByMovieId(req.params.movieId, req.account?.accountId);
  res.json(result);
}

// POST /api/review { movie_id | cinema_id, rating, comment } -> create or update the caller's own
async function create(req, res) {
  const { movie_id, cinema_id, rating, comment, parent_id } = req.body;
  if ((movie_id === undefined) === (cinema_id === undefined)) {
    return res.status(400).json({ message: 'Provide exactly one of movie_id or cinema_id' });
  }

  const target = movie_id !== undefined ? { movie_id: Number(movie_id) } : { cinema_id: Number(cinema_id) };

  if (parent_id !== undefined && parent_id !== null) {
    const parent = await reviewRepository.findById(parent_id);
    if (!parent || parent.hidden) {
      return res.status(404).json({ message: 'Parent review not found' });
    }
    const parentTarget = parent.movie_id != null ? { movie_id: parent.movie_id } : { cinema_id: parent.cinema_id };
    if (parentTarget.movie_id !== target.movie_id || parentTarget.cinema_id !== target.cinema_id) {
      return res.status(400).json({ message: 'parent_id does not match movie_id/cinema_id' });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'comment is required for a reply' });
    }

    const id = await nextId('review');
    const reply = await reviewRepository.create({
      id,
      ...target,
      account_id: req.account.accountId,
      rating: null,
      comment: comment.trim(),
      parent_id: Number(parent_id),
    });
    return res.status(201).json(reply);
  }

  if (rating === undefined) {
    return res.status(400).json({ message: 'rating is required' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'rating must be between 1 and 5' });
  }

  const existing = await reviewRepository.findOwn(target, req.account.accountId);
  if (existing) {
    const updated = await reviewRepository.saveExisting(existing, { rating, comment });
    return res.json(updated);
  }

  const id = await nextId('review');
  const review = await reviewRepository.create({
    id,
    ...target,
    account_id: req.account.accountId,
    rating,
    comment: comment || '',
  });
  res.status(201).json(review);
}

// PUT /api/review/:id { rating?, comment } -> the review's own author edits their review/reply.
// Top-level reviews require a valid rating; replies keep rating null regardless of what's sent.
async function update(req, res) {
  const review = await reviewRepository.findById(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  if (review.account_id !== req.account.accountId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { rating, comment } = req.body;

  if (review.parent_id == null) {
    if (rating === undefined) {
      return res.status(400).json({ message: 'rating is required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be between 1 and 5' });
    }
    const updated = await reviewRepository.saveExisting(review, { rating, comment });
    return res.json(updated);
  }

  if (!comment || !comment.trim()) {
    return res.status(400).json({ message: 'comment is required for a reply' });
  }
  const updated = await reviewRepository.saveExisting(review, { rating: null, comment: comment.trim() });
  res.json(updated);
}

// POST /api/review/:id/report { reason } -> flag someone else's review/reply for moderation
async function report(req, res) {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ message: 'reason is required' });
  }

  const review = await reviewRepository.findById(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  if (review.account_id === req.account.accountId) {
    return res.status(400).json({ message: 'You cannot report your own comment' });
  }

  await reviewRepository.report(req.params.id, req.account.accountId, reason.trim());
  res.json({ message: 'Reported' });
}

// POST /api/review/:id/react { type } -> toggle the caller's reaction on a review or reply (auth required)
async function react(req, res) {
  const { type } = req.body;
  if (!REACTION_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of ${REACTION_TYPES.join(', ')}` });
  }

  const review = await reviewRepository.react(req.params.id, req.account.accountId, type);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(review);
}

// PUT /api/review/:id/hide (admin only — moderation)
async function hide(req, res) {
  const review = await reviewRepository.hide(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(review);
}

// DELETE /api/review/:id (admin, or the review's own author)
async function remove(req, res) {
  const review = await reviewRepository.findById(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });

  if (req.account.role !== 0 && review.account_id !== req.account.accountId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await reviewRepository.remove(review.id);
  res.json({ message: 'Deleted' });
}

module.exports = { listForModeration, listForCinema, listForMovie, create, update, react, report, hide, remove };
