const MovieDirector = require('../models/MovieDirector');

async function findAll() {
  return MovieDirector.find().sort({ id: 1 });
}

async function findByMovieId(movieId) {
  return MovieDirector.find({ movie_id: Number(movieId) }).sort({ id: 1 });
}

async function findByMovieIds(movieIds) {
  return MovieDirector.find({ movie_id: { $in: movieIds } });
}

async function create({ id, movie_id, director_id }) {
  return MovieDirector.create({ id, movie_id: Number(movie_id), director_id: Number(director_id) });
}

async function deleteByMovieId(movieId) {
  return MovieDirector.deleteMany({ movie_id: Number(movieId) });
}

module.exports = { findAll, findByMovieId, findByMovieIds, create, deleteByMovieId };
