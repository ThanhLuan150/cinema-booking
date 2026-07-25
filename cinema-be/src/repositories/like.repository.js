const Like = require('../models/Like');
const Movie = require('../models/Movie');

async function findMine(accountId) {
  const likes = await Like.find({ account_id: accountId }).sort({ id: -1 });
  const movieIds = likes.map((l) => l.movie_id);
  const movies = await Movie.find({ id: { $in: movieIds } });
  return { likes, movies };
}

async function countByMovieId(movieId) {
  return Like.countDocuments({ movie_id: Number(movieId) });
}

async function findOne({ movieId, accountId }) {
  return Like.findOne({ movie_id: Number(movieId), account_id: accountId });
}

async function create({ id, movieId, accountId }) {
  return Like.create({ id, movie_id: Number(movieId), account_id: accountId });
}

async function remove({ movieId, accountId }) {
  return Like.deleteOne({ movie_id: Number(movieId), account_id: accountId });
}

module.exports = { findMine, countByMovieId, findOne, create, remove };
