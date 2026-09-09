const reviewRepository = require('../repositories/review.repository');
const movieReviewEligibility = require('../services/movieReviewEligibility.service');
const Review = require('../models/Review');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const REACTION_TYPES = reviewRepository.REACTION_TYPES;

function canModerateAny(req) {
  return req.permissionScope === 'ALL';
}

// Number(rating) guards against non-numeric input (e.g. "abc") slipping past a bare `< 1 || > 5`
// check, since a NaN comparison is always false either way.
function isValidRating(rating) {
  const n = Number(rating);
  return Number.isFinite(n) && n >= 1 && n <= 5;
}

// GET /api/review?page=&limit=&status=&movieId= -> all reviews including hidden/rejected ones,
// joined with movie/cinema name (review.view permission, ALL scope — moderation dashboard)
async function listForModeration(req, res) {
  if (req.permissionScope !== 'ALL') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await reviewRepository.findAllForModeration({
    skip,
    limit,
    status: req.query.status,
    movieId: req.query.movieId,
  });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/review/my?page=&limit= -> the caller's own top-level reviews, across all statuses
// (review.view permission, OWN scope)
async function listOwn(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await reviewRepository.findOwnByAccount(req.account.accountId, { skip, limit });
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

// GET /api/review/movie/:movieId/eligible-bookings -> the caller's own bookings for this movie
// that satisfy Payment=PAID + Ticket=USED and have not been reviewed yet (auth required). Drives
// the "write a review" affordance on the movie page: no eligible booking, no review form.
async function listEligibleBookings(req, res) {
  const movieId = Number(req.params.movieId);
  const bookings = await movieReviewEligibility.findEligibleBookings(req.account.accountId, movieId);
  const bookingIds = bookings.map((b) => b.id);
  const reviewed = await Review.find({ booking_id: { $in: bookingIds } }, 'booking_id');
  const reviewedBookingIds = new Set(reviewed.map((r) => r.booking_id));

  res.json(
    bookings
      .filter((b) => !reviewedBookingIds.has(b.id))
      .map((b) => ({ booking_id: b.id, code: b.code, schedule_id: b.schedule_id })),
  );
}

// POST /api/review { movie_id, booking_id, rating, comment } -> a verified-purchase movie review
async function create(req, res) {
  const { movie_id, cinema_id, rating, comment, parent_id, booking_id } = req.body;
  if ((movie_id === undefined) === (cinema_id === undefined)) {
    return res.status(400).json({ message: 'Provide exactly one of movie_id or cinema_id' });
  }

  const target = movie_id !== undefined ? { movie_id: Number(movie_id) } : { cinema_id: Number(cinema_id) };

  if (parent_id !== undefined && parent_id !== null) {
    const parent = await reviewRepository.findById(parent_id);
    if (!parent || parent.status !== Review.STATUS.VISIBLE) {
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
  if (!isValidRating(rating)) {
    return res.status(400).json({ message: 'rating must be between 1 and 5' });
  }

  // Cinema reviews carry no purchase-verification rule: one editable review per account per cinema.
  if (cinema_id !== undefined) {
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
    return res.status(201).json(review);
  }

  // Movie review (Ticket 33): must be tied to a verified-purchase booking, one review per booking.
  if (booking_id === undefined || booking_id === null) {
    return res.status(400).json({ message: 'booking_id is required to review a movie' });
  }

  const existingForBooking = await reviewRepository.findByBookingId(booking_id);
  if (existingForBooking) {
    return res.status(409).json({
      message: 'This booking has already been reviewed. Edit the existing review instead.',
      code: 'BOOKING_ALREADY_REVIEWED',
      reviewId: existingForBooking.id,
    });
  }

  const eligibility = await movieReviewEligibility.checkEligibility({
    accountId: req.account.accountId,
    movieId: movie_id,
    bookingId: booking_id,
  });
  if (!eligibility.ok) {
    return res.status(eligibility.status).json({ message: eligibility.message, code: eligibility.code });
  }

  const id = await nextId('review');
  const review = await reviewRepository.create({
    id,
    ...target,
    account_id: req.account.accountId,
    booking_id: Number(booking_id),
    rating,
    comment: comment || '',
  });
  res.status(201).json(review);
}

// PUT /api/review/:id { rating?, comment } -> the review's own author edits their review/reply
// (review.update_own permission; an ALL-scope caller, i.e. Super Admin, may edit any review).
// Top-level reviews require a valid rating; replies keep rating null regardless of what's sent.
// booking_id/movie_id/cinema_id are immutable once set.
async function update(req, res) {
  const review = await reviewRepository.findById(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  if (!canModerateAny(req) && review.account_id !== req.account.accountId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { rating, comment } = req.body;

  if (review.parent_id == null) {
    if (rating === undefined) {
      return res.status(400).json({ message: 'rating is required' });
    }
    if (!isValidRating(rating)) {
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

// PUT /api/review/:id/hide (review.moderate permission) -> admin hides a review from public view
async function hide(req, res) {
  const review = await reviewRepository.hide(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(review);
}

// PUT /api/review/:id/reject (review.moderate permission) -> admin rejects a review (e.g. abusive
// content); distinct from hide so moderation reporting can tell "temporarily hidden" from "rejected".
async function reject(req, res) {
  const review = await reviewRepository.reject(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(review);
}

// PUT /api/review/:id/restore (review.moderate permission) -> reverses a hide/reject
async function restore(req, res) {
  const review = await reviewRepository.setStatus(req.params.id, Review.STATUS.VISIBLE);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  res.json(review);
}

// DELETE /api/review/:id (review.delete_own permission; an ALL-scope caller may delete any review)
async function remove(req, res) {
  const review = await reviewRepository.findById(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });

  if (!canModerateAny(req) && review.account_id !== req.account.accountId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await reviewRepository.remove(review.id);
  res.json({ message: 'Deleted' });
}

module.exports = {
  listForModeration,
  listOwn,
  listForCinema,
  listForMovie,
  listEligibleBookings,
  create,
  update,
  react,
  report,
  hide,
  reject,
  restore,
  remove,
};
