const likeRepository = require('../repositories/like.repository');
const nextId = require('../utils/nextId');
const { emitPublic } = require('../utils/socket');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');
const { withCategories } = require('../utils/withCategories');

// GET /api/like/mine -> movies the caller has liked, joined with movie + category details (auth required)
async function mine(req, res) {
  const { likes, movies } = await likeRepository.findMine(req.account.accountId);
  const moviesWithCategories = await withCategories(movies);
  const movieById = new Map(moviesWithCategories.map((m) => [m.id, m]));
  const result = likes.map((l) => movieById.get(l.movie_id)).filter(Boolean);
  res.json(result);
}

// GET /api/like/:movieId -> like count (number)
async function count(req, res) {
  const total = await likeRepository.countByMovieId(req.params.movieId);
  res.json(total);
}

// POST /api/like { movie_id } (auth required)
async function like(req, res) {
  const { movie_id } = req.body;
  if (movie_id === undefined) return res.status(400).json({ message: 'movie_id is required' });

  const existing = await likeRepository.findOne({ movieId: movie_id, accountId: req.account.accountId });
  if (existing) return res.status(200).json(existing);

  const id = await nextId('like');
  const likeDoc = await likeRepository.create({ id, movieId: movie_id, accountId: req.account.accountId });
  // Only the movie id: the like counter on its page is public, but who liked it is not.
  emitPublic(REALTIME_EVENT.LIKE_UPDATED, { movieId: Number(movie_id) });
  res.status(201).json(likeDoc);
}

// POST /api/unlike { movie_id } (auth required)
async function unlike(req, res) {
  const { movie_id } = req.body;
  if (movie_id === undefined) return res.status(400).json({ message: 'movie_id is required' });

  await likeRepository.remove({ movieId: movie_id, accountId: req.account.accountId });
  emitPublic(REALTIME_EVENT.LIKE_UPDATED, { movieId: Number(movie_id) });
  res.json({ message: 'Unliked' });
}

module.exports = { mine, count, like, unlike };
