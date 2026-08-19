const movieRepository = require('../repositories/movie.repository');
const nextId = require('../utils/nextId');
const { emitPublic } = require('../utils/socket');
const { withCategories } = require('../utils/withCategories');
const { withActorsAndDirectors } = require('../utils/withActorsAndDirectors');
const { uploadImage, uploadTrailer } = require('../utils/uploadImage');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Attaches categories + actors + directors in one pass (used by every read path below).
async function withRelations(movies) {
  return withActorsAndDirectors(await withCategories(movies));
}

// GET /api/movie?search=&category=&country=&date=&cinema=&status=&page=&limit= -> public catalog

async function list(req, res) {
  const { search, category, country, date, cinema, status } = req.query;
  // $ne (not $eq 'ACTIVE') so movies persisted before the status field existed still show up.
  const filter = { status: { $ne: 'INACTIVE' } };
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

// GET /api/movie/mine?status= -> management list (movie.read permission). The Movie Catalog is
// company-wide, so every internal role that can reach this route (super admin, branch admin,
// employee) sees the same full catalog; `status` optionally narrows to ACTIVE/INACTIVE (e.g. a
// branch admin's Create Showtime screen only wants ACTIVE movies). Must stay above GET /:id so
// "mine" isn't swallowed as an :id param.
async function mine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await movieRepository.findMine({
    status: req.query.status,
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

// POST /api/movie (movie.create permission — Super Admin only; movie.create is the sole gate,
async function create(req, res) {
  const { name, avatar, premiere_date, description, country, trailer, producer, producerAvatar, status, duration } =
    req.body;
  if (!name || !premiere_date) {
    return res.status(400).json({ message: 'name and premiere_date are required' });
  }
  if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ message: 'status must be ACTIVE or INACTIVE' });
  }
  if (duration !== undefined && (Number.isNaN(Number(duration)) || Number(duration) < 0)) {
    return res.status(400).json({ message: 'duration must be a non-negative number' });
  }

  const avatarFile = req.files?.avatar?.[0];
  const trailerFile = req.files?.trailer?.[0];
  const producerAvatarFile = req.files?.producerAvatar?.[0];
  const avatarUrl = avatarFile ? await uploadImage(avatarFile) : avatar || '';
  const trailerUrl = trailerFile ? await uploadTrailer(trailerFile) : trailer || '';
  const producerAvatarUrl = producerAvatarFile ? await uploadImage(producerAvatarFile) : producerAvatar || '';

  const id = await nextId('movie');
  const movie = await movieRepository.create({
    id,
    owner_id: req.account.accountId,
    status: status || 'ACTIVE',
    name,
    avatar: avatarUrl,
    duration: duration !== undefined ? Number(duration) : 0,
    premiere_date,
    description: description || '',
    country: country || '',
    trailer: trailerUrl,
    producer: producer || '',
    producerAvatar: producerAvatarUrl,
  });

  emitPublic('movie:new', movie);
  res.status(201).json(movie);
}

// PUT /api/movie/:id (movie.update permission — Super Admin only)
async function update(req, res) {
  const existing = await movieRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Movie not found' });

  if (req.body.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(req.body.status)) {
    return res.status(400).json({ message: 'status must be ACTIVE or INACTIVE' });
  }
  if (req.body.duration !== undefined && (Number.isNaN(Number(req.body.duration)) || Number(req.body.duration) < 0)) {
    return res.status(400).json({ message: 'duration must be a non-negative number' });
  }

  const fields = [
    'name',
    'avatar',
    'duration',
    'premiere_date',
    'description',
    'country',
    'trailer',
    'producer',
    'producerAvatar',
    'status',
  ];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.duration !== undefined) updates.duration = Number(updates.duration);
  const avatarFile = req.files?.avatar?.[0];
  const trailerFile = req.files?.trailer?.[0];
  const producerAvatarFile = req.files?.producerAvatar?.[0];
  if (avatarFile) updates.avatar = await uploadImage(avatarFile);
  if (trailerFile) updates.trailer = await uploadTrailer(trailerFile);
  if (producerAvatarFile) updates.producerAvatar = await uploadImage(producerAvatarFile);

  const movie = await movieRepository.updateFields(req.params.id, updates);
  res.json(movie);
}

// DELETE /api/movie/:id (movie.delete permission — Super Admin only)
async function remove(req, res) {
  const existing = await movieRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Movie not found' });

  await movieRepository.remove(existing.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, mine, getById, create, update, remove };
