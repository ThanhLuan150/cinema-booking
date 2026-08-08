const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Schedule = require('../models/Schedule');

async function findCategoryMovieIds(categoryId) {
  const mappings = await MovieCategory.find({ cat_id: Number(categoryId) });
  return mappings.map((m) => m.movie_id);
}

async function findScheduleMovieIds({ date, cinema }) {
  const scheduleFilter = { status: { $ne: 'CANCELLED' } };
  if (date) scheduleFilter.movie_date = date;
  if (cinema) scheduleFilter.cinema_id = Number(cinema);
  const schedules = await Schedule.find(scheduleFilter);
  return [...new Set(schedules.map((s) => s.movie_id))];
}

async function findFiltered(filter, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Movie.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Movie.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Movie.findOne({ id: Number(id) });
}

async function findMine({ status, skip = 0, limit = 20 }) {
  // The Movie Catalog is company-wide: every internal role reaching this route (super admin,
  // branch admin, employee) sees the same full catalog, optionally narrowed by status.
  const filter = {};
  if (status === 'ACTIVE' || status === 'INACTIVE') filter.status = status;
  const [data, total] = await Promise.all([
    Movie.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Movie.countDocuments(filter),
  ]);
  return { data, total };
}

async function create(data) {
  return Movie.create(data);
}

async function updateFields(id, updates) {
  return Movie.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Movie.deleteOne({ id: Number(id) });
}

module.exports = {
  findCategoryMovieIds,
  findScheduleMovieIds,
  findFiltered,
  findById,
  findMine,
  create,
  updateFields,
  remove,
};
