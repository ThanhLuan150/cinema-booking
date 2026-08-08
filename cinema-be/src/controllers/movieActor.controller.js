const movieActorRepository = require('../repositories/movieActor.repository');
const nextId = require('../utils/nextId');
const { assertMovieOwnership } = require('../utils/movieOwnership');

async function list(req, res) {
  const mappings = await movieActorRepository.findAll();
  res.json(mappings);
}

async function getForMovie(req, res) {
  const mappings = await movieActorRepository.findByMovieId(req.params.movieId);
  res.json(mappings);
}

async function create(req, res) {
  const { movie_id, actor_id, character_name, is_lead } = req.body;
  if (movie_id === undefined || actor_id === undefined) {
    return res.status(400).json({ message: 'movie_id and actor_id are required' });
  }
  if (!(await assertMovieOwnership(req, movie_id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const id = await nextId('movieActor');
  const mapping = await movieActorRepository.create({ id, movie_id, actor_id, character_name, is_lead });
  res.status(201).json(mapping);
}

async function removeForMovie(req, res) {
  if (!(await assertMovieOwnership(req, req.params.movieId))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await movieActorRepository.deleteByMovieId(req.params.movieId);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getForMovie, create, removeForMovie };
