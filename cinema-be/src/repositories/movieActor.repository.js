const MovieActor = require('../models/MovieActor');

async function findAll() {
  return MovieActor.find().sort({ id: 1 });
}

async function findByMovieId(movieId) {
  return MovieActor.find({ movie_id: Number(movieId) }).sort({ id: 1 });
}

async function findByMovieIds(movieIds) {
  return MovieActor.find({ movie_id: { $in: movieIds } });
}

async function create({ id, movie_id, actor_id, character_name, is_lead }) {
  return MovieActor.create({
    id,
    movie_id: Number(movie_id),
    actor_id: Number(actor_id),
    character_name: character_name || '',
    is_lead: Boolean(is_lead),
  });
}

async function deleteByMovieId(movieId) {
  return MovieActor.deleteMany({ movie_id: Number(movieId) });
}

module.exports = { findAll, findByMovieId, findByMovieIds, create, deleteByMovieId };
