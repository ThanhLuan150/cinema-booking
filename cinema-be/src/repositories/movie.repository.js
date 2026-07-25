const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');

async function findCategoryMovieIds(categoryId) {
  const mappings = await MovieCategory.find({ cat_id: Number(categoryId) });
  return mappings.map((m) => m.movie_id);
}

async function findScheduleMovieIds({ date, cinema }) {
  const scheduleFilter = {};
  if (date) scheduleFilter.movie_date = date;
  if (cinema) {
    const rooms = await Room.find({ cinema_id: Number(cinema) });
    scheduleFilter.room_id = { $in: rooms.map((r) => r.id) };
  }
  const schedules = await Schedule.find(scheduleFilter);
  return [...new Set(schedules.map((s) => s.movie_id))];
}

async function findFiltered(filter) {
  return Movie.find(filter).sort({ id: -1 });
}

async function findById(id) {
  return Movie.findOne({ id: Number(id) });
}

async function findMine({ role, accountId }) {
  const filter = role === 2 ? { owner_id: accountId } : {};
  return Movie.find(filter).sort({ id: -1 });
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
