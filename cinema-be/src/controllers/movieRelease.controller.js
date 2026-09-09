const movieReleaseRepository = require('../repositories/movieRelease.repository');
const distributorRepository = require('../repositories/distributor.repository');
const movieRepository = require('../repositories/movie.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { isValidDateStr } = require('../utils/releaseWindow');

// Attach a small movie + distributor summary so the release list is self-describing even for
// a Branch Admin (who has movieRelease.read but no access to the distributor endpoint).
async function decorate(releases) {
  const rows = releases.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r));
  const movieIds = [...new Set(rows.map((r) => r.movie_id))];
  const distributorIds = [...new Set(rows.map((r) => r.distributor_id))];
  const [movies, distributors] = await Promise.all([
    Promise.all(movieIds.map((id) => movieRepository.findById(id))),
    Promise.all(distributorIds.map((id) => distributorRepository.findById(id))),
  ]);
  const movieById = new Map(movies.filter(Boolean).map((m) => [m.id, m]));
  const distributorById = new Map(distributors.filter(Boolean).map((d) => [d.id, d]));
  return rows.map((r) => ({
    ...r,
    movie: movieById.has(r.movie_id)
      ? { id: r.movie_id, name: movieById.get(r.movie_id).name, premiere_date: movieById.get(r.movie_id).premiere_date }
      : null,
    distributor: distributorById.has(r.distributor_id)
      ? { id: r.distributor_id, name: distributorById.get(r.distributor_id).name, code: distributorById.get(r.distributor_id).code }
      : null,
  }));
}

// GET /api/movie-releases?movieId=&distributorId=&status=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.movieId) filter.movie_id = Number(req.query.movieId);
  if (req.query.distributorId) filter.distributor_id = Number(req.query.distributorId);
  if (req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE') filter.status = req.query.status;

  const { data, total } = await movieReleaseRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data: await decorate(data), total, page, limit }));
}

// GET /api/movie-releases/:id
async function getById(req, res) {
  const release = await movieReleaseRepository.findById(req.params.id);
  if (!release) return res.status(404).json({ message: 'Movie release not found' });
  const [decorated] = await decorate([release]);
  res.json(decorated);
}

async function validateDates({ release_date, end_date }) {
  const errors = [];
  if (!isValidDateStr(release_date)) {
    errors.push('release_date is required as YYYY-MM-DD');
  }
  if (end_date !== undefined && end_date !== null && end_date !== '') {
    if (!isValidDateStr(end_date)) {
      errors.push('end_date must be YYYY-MM-DD');
    } else if (isValidDateStr(release_date) && end_date < release_date) {
      errors.push('end_date cannot be before release_date');
    }
  }
  return errors;
}

// POST /api/movie-releases
async function create(req, res) {
  const { movie_id, distributor_id, release_date } = req.body;
  const end_date = req.body.end_date === '' || req.body.end_date === undefined ? null : req.body.end_date;

  if (!movie_id || !distributor_id) {
    return res.status(400).json({ message: 'movie_id and distributor_id are required' });
  }
  const dateErrors = await validateDates({ release_date, end_date });
  if (dateErrors.length) return res.status(400).json({ message: dateErrors.join('; ') });
  if (req.body.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(req.body.status)) {
    return res.status(400).json({ message: 'status must be ACTIVE or INACTIVE' });
  }

  const movie = await movieRepository.findById(movie_id);
  if (!movie) return res.status(404).json({ message: 'Movie not found' });
  const distributor = await distributorRepository.findById(distributor_id);
  if (!distributor) return res.status(404).json({ message: 'Distributor not found' });
  if (distributor.status !== 'ACTIVE') {
    return res.status(400).json({ message: 'Distributor is not active', code: 'DISTRIBUTOR_NOT_ACTIVE' });
  }

  if (await movieReleaseRepository.findByMovieAndDistributor(movie_id, distributor_id)) {
    return res.status(409).json({
      message: 'This movie already has a release for this distributor',
      code: 'RELEASE_DUPLICATE',
    });
  }

  const id = await nextId('movieRelease');
  try {
    const release = await movieReleaseRepository.create({
      id,
      movie_id: Number(movie_id),
      distributor_id: Number(distributor_id),
      release_date,
      end_date: end_date || null,
      status: req.body.status || 'ACTIVE',
    });
    const [decorated] = await decorate([release]);
    res.status(201).json(decorated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This movie already has a release for this distributor', code: 'RELEASE_DUPLICATE' });
    }
    throw err;
  }
}

// PUT /api/movie-releases/:id
async function update(req, res) {
  const release = await movieReleaseRepository.findById(req.params.id);
  if (!release) return res.status(404).json({ message: 'Movie release not found' });

  const release_date = req.body.release_date !== undefined ? req.body.release_date : release.release_date;
  const end_date =
    req.body.end_date === undefined
      ? release.end_date
      : req.body.end_date === '' || req.body.end_date === null
        ? null
        : req.body.end_date;

  const dateErrors = await validateDates({ release_date, end_date });
  if (dateErrors.length) return res.status(400).json({ message: dateErrors.join('; ') });
  if (req.body.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(req.body.status)) {
    return res.status(400).json({ message: 'status must be ACTIVE or INACTIVE' });
  }

  if (req.body.distributor_id !== undefined && Number(req.body.distributor_id) !== release.distributor_id) {
    const distributor = await distributorRepository.findById(req.body.distributor_id);
    if (!distributor) return res.status(404).json({ message: 'Distributor not found' });
    if (distributor.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Distributor is not active', code: 'DISTRIBUTOR_NOT_ACTIVE' });
    }
    if (await movieReleaseRepository.findByMovieAndDistributor(release.movie_id, req.body.distributor_id)) {
      return res.status(409).json({ message: 'This movie already has a release for this distributor', code: 'RELEASE_DUPLICATE' });
    }
  }

  const updates = { release_date, end_date: end_date || null };
  if (req.body.distributor_id !== undefined) updates.distributor_id = Number(req.body.distributor_id);
  if (req.body.status !== undefined) updates.status = req.body.status;

  try {
    const updated = await movieReleaseRepository.updateFields(release.id, updates);
    const [decorated] = await decorate([updated]);
    res.json(decorated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This movie already has a release for this distributor', code: 'RELEASE_DUPLICATE' });
    }
    throw err;
  }
}

// DELETE /api/movie-releases/:id
async function remove(req, res) {
  const release = await movieReleaseRepository.findById(req.params.id);
  if (!release) return res.status(404).json({ message: 'Movie release not found' });
  await movieReleaseRepository.remove(release.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
