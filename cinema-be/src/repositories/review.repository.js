const Review = require('../models/Review');
const Movie = require('../models/Movie');
const Cinema = require('../models/Cinema');

function withAverage(reviews) {
  const average = reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 0;
  return { reviews, average, count: reviews.length };
}

// All reviews including hidden ones, joined with movie/cinema name (admin moderation view)
async function findAllForModeration() {
  const reviews = await Review.find().sort({ createdAt: -1 });
  const movieIds = [...new Set(reviews.filter((r) => r.movie_id != null).map((r) => r.movie_id))];
  const cinemaIds = [...new Set(reviews.filter((r) => r.cinema_id != null).map((r) => r.cinema_id))];
  const movies = await Movie.find({ id: { $in: movieIds } });
  const cinemas = await Cinema.find({ id: { $in: cinemaIds } });
  const movieById = new Map(movies.map((m) => [m.id, m]));
  const cinemaById = new Map(cinemas.map((c) => [c.id, c]));

  return reviews.map((r) => ({
    ...r.toJSON(),
    movie: r.movie_id != null && movieById.get(r.movie_id) ? { name: movieById.get(r.movie_id).name } : null,
    cinema: r.cinema_id != null && cinemaById.get(r.cinema_id) ? { name: cinemaById.get(r.cinema_id).name } : null,
  }));
}

async function findVisibleByCinemaId(cinemaId) {
  const reviews = await Review.find({ cinema_id: Number(cinemaId), hidden: false }).sort({ createdAt: -1 });
  return withAverage(reviews);
}

async function findVisibleByMovieId(movieId) {
  const reviews = await Review.find({ movie_id: Number(movieId), hidden: false }).sort({ createdAt: -1 });
  return withAverage(reviews);
}

async function findOwn(target, accountId) {
  return Review.findOne({ ...target, account_id: accountId });
}

async function create(data) {
  return Review.create(data);
}

async function saveExisting(review, { rating, comment }) {
  review.rating = rating;
  review.comment = comment || '';
  await review.save();
  return review;
}

async function hide(id) {
  return Review.findOneAndUpdate({ id: Number(id) }, { $set: { hidden: true } }, { new: true });
}

async function findById(id) {
  return Review.findOne({ id: Number(id) });
}

async function remove(id) {
  return Review.deleteOne({ id: Number(id) });
}

module.exports = {
  findAllForModeration,
  findVisibleByCinemaId,
  findVisibleByMovieId,
  findOwn,
  create,
  saveExisting,
  hide,
  findById,
  remove,
};
