const MovieCategory = require('../models/MovieCategory');

async function findAll() {
  return MovieCategory.find().sort({ id: 1 });
}

async function findByMovieId(movieId) {
  return MovieCategory.find({ movie_id: Number(movieId) }).sort({ id: 1 });
}

async function create({ id, movie_id, cat_id }) {
  return MovieCategory.create({ id, movie_id: Number(movie_id), cat_id: Number(cat_id) });
}

async function deleteByMovieId(movieId) {
  return MovieCategory.deleteMany({ movie_id: Number(movieId) });
}

module.exports = { findAll, findByMovieId, create, deleteByMovieId };
