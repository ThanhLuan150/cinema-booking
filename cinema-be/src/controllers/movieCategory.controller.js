const movieCategoryRepository = require('../repositories/movieCategory.repository');
const nextId = require('../utils/nextId');
const { assertMovieOwnership } = require('../utils/movieOwnership');

async function list(req, res) {
  const mappings = await movieCategoryRepository.findAll();
  res.json(mappings);
}

async function getCategoryIdsForMovie(req, res) {
  const mappings = await movieCategoryRepository.findByMovieId(req.params.movieId);
  res.json(mappings.map((m) => m.cat_id));
}

async function create(req, res) {
  const { movie_id, cat_id } = req.body;
  if (movie_id === undefined || cat_id === undefined) {
    return res.status(400).json({ message: 'movie_id and cat_id are required' });
  }
  if (!(await assertMovieOwnership(req, movie_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const id = await nextId('movieCategory');
  const mapping = await movieCategoryRepository.create({ id, movie_id, cat_id });
  res.status(201).json(mapping);
}

async function removeForMovie(req, res) {
  if (!(await assertMovieOwnership(req, req.params.movieId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await movieCategoryRepository.deleteByMovieId(req.params.movieId);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getCategoryIdsForMovie, create, removeForMovie };
