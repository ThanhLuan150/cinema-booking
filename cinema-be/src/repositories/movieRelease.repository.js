const MovieRelease = require('../models/MovieRelease');

async function findFiltered(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    MovieRelease.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    MovieRelease.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return MovieRelease.findOne({ id: Number(id) });
}

// Every release row for a movie (used by the showtime validation).
async function findByMovieId(movieId, { activeOnly = false } = {}) {
  const filter = { movie_id: Number(movieId) };
  if (activeOnly) filter.status = 'ACTIVE';
  return MovieRelease.find(filter).sort({ release_date: 1 });
}

async function findByMovieAndDistributor(movieId, distributorId) {
  return MovieRelease.findOne({ movie_id: Number(movieId), distributor_id: Number(distributorId) });
}

async function existsForDistributor(distributorId) {
  return Boolean(await MovieRelease.exists({ distributor_id: Number(distributorId) }));
}

async function create(data) {
  return MovieRelease.create(data);
}

async function updateFields(id, updates) {
  return MovieRelease.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return MovieRelease.deleteOne({ id: Number(id) });
}

module.exports = {
  findFiltered,
  findById,
  findByMovieId,
  findByMovieAndDistributor,
  existsForDistributor,
  create,
  updateFields,
  remove,
};
