const movieDirectorRepository = require('../repositories/movieDirector.repository');
const nextId = require('../utils/nextId');
const { assertMovieOwnership } = require('../utils/movieOwnership');

async function list(req, res) {
  const mappings = await movieDirectorRepository.findAll();
  res.json(mappings);
}

async function getForMovie(req, res) {
  const mappings = await movieDirectorRepository.findByMovieId(req.params.movieId);
  res.json(mappings);
}

async function create(req, res) {
  const { movie_id, director_id } = req.body;
  if (movie_id === undefined || director_id === undefined) {
    return res.status(400).json({ message: 'movie_id and director_id are required' });
  }
  if (!(await assertMovieOwnership(req, movie_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const id = await nextId('movieDirector');
  const mapping = await movieDirectorRepository.create({ id, movie_id, director_id });
  res.status(201).json(mapping);
}

async function removeForMovie(req, res) {
  if (!(await assertMovieOwnership(req, req.params.movieId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await movieDirectorRepository.deleteByMovieId(req.params.movieId);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getForMovie, create, removeForMovie };
