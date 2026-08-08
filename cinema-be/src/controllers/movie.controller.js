const movieRepository = require('../repositories/movie.repository');
const nextId = require('../utils/nextId');
const { emitPublic } = require('../utils/socket');
const { withCategories } = require('../utils/withCategories');
const { withActorsAndDirectors } = require('../utils/withActorsAndDirectors');
const { uploadImage, uploadTrailer } = require('../utils/uploadImage');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { assertMovieOwnership } = require('../utils/movieOwnership');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Attaches categories + actors + directors in one pass (used by every read path below).
async function withRelations(movies) {
  return withActorsAndDirectors(await withCategories(movies));
}

// GET /api/movie?search=&category=&country=&date=&cinema=&status=&page=&limit=
async function list(req, res) {
  const { search, category, country, date, cinema, status } = req.query;
  const filter = {};
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  if (country) filter.country = { $regex: escapeRegex(country), $options: 'i' };
  if (status === 'playing' || status === 'upcoming') {
    const today = new Date().toISOString().split('T')[0];
    filter.premiere_date = status === 'playing' ? { $lte: today } : { $gt: today };
  }

  let movieIds = null; // null = no restriction; array = must be in this set

  if (category) {
    movieIds = await movieRepository.findCategoryMovieIds(category);
  }

  if (date || cinema) {
    const scheduleMovieIds = await movieRepository.findScheduleMovieIds({ date, cinema });
    movieIds = movieIds === null ? scheduleMovieIds : movieIds.filter((id) => scheduleMovieIds.includes(id));
  }

  if (movieIds !== null) filter.id = { $in: movieIds };

  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await movieRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data: await withRelations(data), total, page, limit }));
}

// GET /api/movie/mine -> management list (admin or theater staff). Admin sees every movie;
// a theater owner only sees the movies they personally added. Must stay above GET /:id so
// "mine" isn't swallowed as an :id param.
async function mine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await movieRepository.findMine({
    role: req.account.role,
    accountId: req.account.accountId,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data: await withRelations(data), total, page, limit }));
}

// GET /api/movie/:id
async function getById(req, res) {
  const movie = await movieRepository.findById(req.params.id);
  if (!movie) return res.status(404).json({ message: 'Movie not found' });

  const [enriched] = await withRelations([movie]);
  res.json(enriched);
}

// POST /api/movie (admin or theater staff)
async function create(req, res) {
  const { name, avatar, premiere_date, description, country, trailer, producer, producerAvatar } = req.body;
  if (!name || !premiere_date) {
    return res.status(400).json({ message: 'name and premiere_date are required' });
  }

  const avatarFile = req.files?.avatar?.[0];
  const trailerFile = req.files?.trailer?.[0];
  const avatarUrl = avatarFile ? await uploadImage(avatarFile) : avatar || '';
  const trailerUrl = trailerFile ? await uploadTrailer(trailerFile) : trailer || '';

  const id = await nextId('movie');
  const movie = await movieRepository.create({
    id,
    owner_id: req.account.accountId,
    name,
    avatar: avatarUrl,
    premiere_date,
    description: description || '',
    country: country || '',
    trailer: trailerUrl,
    producer: producer || '',
    producerAvatar: producerAvatar || '',
  });

  emitPublic('movie:new', movie);
  res.status(201).json(movie);
}

// PUT /api/movie/:id (movie.update permission; a theater owner may only edit movies they added)
async function update(req, res) {
  const existing = await movieRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Movie not found' });
  if (!(await assertMovieOwnership(req, existing.id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const fields = [
    'name',
    'avatar',
    'premiere_date',
    'description',
    'country',
    'trailer',
    'producer',
    'producerAvatar',
  ];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const avatarFile = req.files?.avatar?.[0];
  const trailerFile = req.files?.trailer?.[0];
  if (avatarFile) updates.avatar = await uploadImage(avatarFile);
  if (trailerFile) updates.trailer = await uploadTrailer(trailerFile);

  const movie = await movieRepository.updateFields(req.params.id, updates);
  res.json(movie);
}

// DELETE /api/movie/:id (movie.delete permission; a theater owner may only delete movies they added)
async function remove(req, res) {
  const existing = await movieRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Movie not found' });
  if (!(await assertMovieOwnership(req, existing.id))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await movieRepository.remove(existing.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, mine, getById, create, update, remove };
