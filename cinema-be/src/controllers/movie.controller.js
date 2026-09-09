const movieRepository = require('../repositories/movie.repository');
const Movie = require('../models/Movie');
const nextId = require('../utils/nextId');
const { emitPublic } = require('../utils/socket');
const { withCategories } = require('../utils/withCategories');
const { withActorsAndDirectors } = require('../utils/withActorsAndDirectors');
const { uploadImage, uploadTrailer } = require('../utils/uploadImage');
const MEDIA = require('../config/mediaConstraints');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// multipart/form-data serialises everything as strings; a checkbox-style flag arrives as
// "true"/"false"/"1"/"0". Anything else (including an actual boolean from a JSON client) is
// coerced the same way so `featured` is always stored as a real boolean.
function parseBoolean(raw) {
  if (typeof raw === 'boolean') return raw;
  return raw === 'true' || raw === '1' || raw === 1;
}

// Gallery URLs can reach us as a real array (JSON client), a JSON-encoded array string, or a
// comma-joined string (FormData flattens arrays with String()). Normalise all three to a
// deduped, trimmed array of non-empty strings.
function parseStringArray(raw) {
  let values = [];
  if (Array.isArray(raw)) {
    values = raw;
  } else if (typeof raw === 'string' && raw.trim() !== '') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        values = Array.isArray(parsed) ? parsed : [];
      } catch {
        values = trimmed.split(',');
      }
    } else {
      values = trimmed.split(',');
    }
  }
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
}

// Attaches categories + actors + directors in one pass (used by every read path below).
async function withRelations(movies) {
  return withActorsAndDirectors(await withCategories(movies));
}

// GET /api/movie?search=&category=&country=&date=&cinema=&status=&featured=&page=&limit= -> public catalog

async function list(req, res) {
  const { search, category, country, date, cinema, status, featured } = req.query;
  // $ne (not $eq 'ACTIVE') so movies persisted before the status field existed still show up.
  const filter = { status: { $ne: 'INACTIVE' } };
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  if (country) filter.country = { $regex: escapeRegex(country), $options: 'i' };
  if (featured === 'true') filter.featured = true;
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
  const {
    name,
    avatar,
    premiere_date,
    description,
    country,
    trailer,
    producer,
    producerAvatar,
    status,
    duration,
    banner,
    gallery,
    age_rating,
    language,
    subtitle,
    featured,
  } = req.body;
  if (!name || !premiere_date) {
    return res.status(400).json({ message: 'name and premiere_date are required' });
  }
  if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ message: 'status must be ACTIVE or INACTIVE' });
  }
  if (duration !== undefined && (Number.isNaN(Number(duration)) || Number(duration) < 0)) {
    return res.status(400).json({ message: 'duration must be a non-negative number' });
  }
  if (age_rating !== undefined && age_rating !== '' && !Movie.AGE_RATINGS.includes(age_rating)) {
    return res.status(400).json({ message: `age_rating must be one of ${Movie.AGE_RATINGS.join(', ')}` });
  }

  const avatarFile = req.files?.avatar?.[0];
  const trailerFile = req.files?.trailer?.[0];
  const producerAvatarFile = req.files?.producerAvatar?.[0];
  const bannerFile = req.files?.banner?.[0];
  const galleryFiles = req.files?.gallery || [];
  const avatarUrl = avatarFile ? await uploadImage(avatarFile, 'movies', MEDIA.POSTER) : avatar || '';
  const trailerUrl = trailerFile ? await uploadTrailer(trailerFile, 'movies', MEDIA.TRAILER) : trailer || '';
  const producerAvatarUrl = producerAvatarFile ? await uploadImage(producerAvatarFile) : producerAvatar || '';
  const bannerUrl = bannerFile ? await uploadImage(bannerFile, 'movies', MEDIA.BANNER) : banner || '';
  const uploadedGallery = await Promise.all(galleryFiles.map((file) => uploadImage(file, 'movies', MEDIA.GALLERY)));
  const galleryUrls = [...new Set([...parseStringArray(gallery), ...uploadedGallery])];

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
    banner: bannerUrl,
    gallery: galleryUrls,
    age_rating: age_rating || 'P',
    language: language || '',
    subtitle: subtitle || '',
    featured: parseBoolean(featured),
  });

  await recordAudit({
    req,
    action: ACTION.CREATE_MOVIE,
    entityType: ENTITY_TYPE.MOVIE,
    entityId: movie.id,
    metadata: { name: movie.name },
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
  if (
    req.body.age_rating !== undefined &&
    req.body.age_rating !== '' &&
    !Movie.AGE_RATINGS.includes(req.body.age_rating)
  ) {
    return res.status(400).json({ message: `age_rating must be one of ${Movie.AGE_RATINGS.join(', ')}` });
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
    'banner',
    'age_rating',
    'language',
    'subtitle',
  ];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.duration !== undefined) updates.duration = Number(updates.duration);
  if (req.body.featured !== undefined) updates.featured = parseBoolean(req.body.featured);

  const avatarFile = req.files?.avatar?.[0];
  const trailerFile = req.files?.trailer?.[0];
  const producerAvatarFile = req.files?.producerAvatar?.[0];
  const bannerFile = req.files?.banner?.[0];
  const galleryFiles = req.files?.gallery || [];
  if (avatarFile) updates.avatar = await uploadImage(avatarFile, 'movies', MEDIA.POSTER);
  if (trailerFile) updates.trailer = await uploadTrailer(trailerFile, 'movies', MEDIA.TRAILER);
  if (producerAvatarFile) updates.producerAvatar = await uploadImage(producerAvatarFile);
  if (bannerFile) updates.banner = await uploadImage(bannerFile, 'movies', MEDIA.BANNER);
  // A `gallery` body field replaces the list (URLs the client chose to keep); uploaded files are
  // appended to that list, or to the existing gallery when the client sent files only.
  if (req.body.gallery !== undefined || galleryFiles.length > 0) {
    const kept = req.body.gallery !== undefined ? parseStringArray(req.body.gallery) : existing.gallery;
    const uploaded = await Promise.all(galleryFiles.map((file) => uploadImage(file, 'movies', MEDIA.GALLERY)));
    updates.gallery = [...new Set([...kept, ...uploaded])];
  }

  const movie = await movieRepository.updateFields(req.params.id, updates);

  await recordAudit({
    req,
    action: ACTION.UPDATE_MOVIE,
    entityType: ENTITY_TYPE.MOVIE,
    entityId: Number(req.params.id),
    metadata: { fields: Object.keys(updates) },
  });

  res.json(movie);
}

// DELETE /api/movie/:id (movie.delete permission — Super Admin only)
async function remove(req, res) {
  const existing = await movieRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Movie not found' });

  await movieRepository.remove(existing.id);

  await recordAudit({
    req,
    action: ACTION.DELETE_MOVIE,
    entityType: ENTITY_TYPE.MOVIE,
    entityId: existing.id,
    metadata: { name: existing.name },
  });

  res.json({ message: 'Deleted' });
}

module.exports = { list, mine, getById, create, update, remove };
