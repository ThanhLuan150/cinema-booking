const reviewRepository = require('../repositories/review.repository');
const nextId = require('../utils/nextId');

// GET /api/review -> all reviews including hidden ones, joined with movie/cinema name (admin only — moderation)
async function listForModeration(req, res) {
  const result = await reviewRepository.findAllForModeration();
  res.json(result);
}

// GET /api/review/cinema/:cinemaId -> visible reviews for a cinema + average rating
async function listForCinema(req, res) {
  const result = await reviewRepository.findVisibleByCinemaId(req.params.cinemaId);
  res.json(result);
}

// GET /api/review/:movieId -> visible reviews for a movie + average rating
async function listForMovie(req, res) {
  const result = await reviewRepository.findVisibleByMovieId(req.params.movieId);
  res.json(result);
}

// POST /api/review { movie_id | cinema_id, rating, comment } -> create or update the caller's own
// review for exactly one target (auth required)
async function create(req, res) {
  const { movie_id, cinema_id, rating, comment } = req.body;
  if ((movie_id === undefined) === (cinema_id === undefined)) {
    return res.status(400).json({ message: 'Provide exactly one of movie_id or cinema_id' });
  }
  if (rating === undefined) {
    return res.status(400).json({ message: 'rating is required' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'rating must be between 1 and 5' });
  }

  const target = movie_id !== undefined ? { movie_id: Number(movie_id) } : { cinema_id: Number(cinema_id) };

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

module.exports = { listForModeration, listForCinema, listForMovie, create, hide, remove };
