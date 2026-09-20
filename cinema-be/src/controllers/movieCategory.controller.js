const movieCategoryRepository = require('../repositories/movieCategory.repository');
const nextId = require('../utils/nextId');
const { emitPublic } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');

function broadcastMovieLink(movieId, action) {
  if (movieId === undefined || movieId === null) return;
  emitPublic(REALTIME_EVENT.CATALOGUE_UPDATED, { scope: 'MOVIE_CATEGORY', action, movieId: Number(movieId) });
}

async function list(req, res) {
  const mappings = await movieCategoryRepository.findAll();
  res.json(mappings);
}

async function getCategoryIdsForMovie(req, res) {
  const mappings = await movieCategoryRepository.findByMovieId(req.params.movieId);
  res.json(mappings.map((m) => m.cat_id));
}

// Tagging a movie's categories is part of editing the movie itself, so movie.update
// (Super Admin only) is the entire authorization check — see movie.routes.js.
async function create(req, res) {
  const { movie_id, cat_id } = req.body;
  if (movie_id === undefined || cat_id === undefined) {
    return res.status(400).json({ message: 'movie_id and cat_id are required' });
  }

  const id = await nextId('movieCategory');
  const mapping = await movieCategoryRepository.create({ id, movie_id, cat_id });
  broadcastMovieLink(movie_id, REALTIME_ACTION.CREATED);
  res.status(201).json(mapping);
}

async function removeForMovie(req, res) {
  await movieCategoryRepository.deleteByMovieId(req.params.movieId);
  broadcastMovieLink(req.params.movieId, REALTIME_ACTION.DELETED);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getCategoryIdsForMovie, create, removeForMovie };
