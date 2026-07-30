const Cinema = require('../models/Cinema');
const Account = require('../models/Account');
const FavoriteCinema = require('../models/FavoriteCinema');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Review = require('../models/Review');
const nextId = require('../utils/nextId');

async function findApproved({ skip = 0, limit = 20 } = {}) {
  const filter = { status: 1 };
  const [data, total] = await Promise.all([
    Cinema.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Cinema.countDocuments(filter),
  ]);
  return { data, total };
}

async function findMine({ role, accountId, skip = 0, limit = 20 }) {
  const filter = role === 0 ? {} : { owner_id: accountId };
  const [data, total] = await Promise.all([
    Cinema.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Cinema.countDocuments(filter),
  ]);
  return { data, total };
}

async function findPending() {
  return Cinema.find({ status: 0 }).sort({ id: -1 });
}

// Approved cinemas ranked by ticket booking volume, enriched with the average customer
// rating across the movies they've screened.
async function getTopRanked() {
  const cinemas = await Cinema.find({ status: 1 }).sort({ id: -1 });
  const cinemaIds = cinemas.map((c) => c.id);

  const rooms = await Room.find({ cinema_id: { $in: cinemaIds } });
  const cinemaIdByRoomId = new Map(rooms.map((r) => [r.id, r.cinema_id]));
  const roomIds = rooms.map((r) => r.id);

  const schedules = await Schedule.find({ room_id: { $in: roomIds } });
  const cinemaIdByScheduleId = new Map();
  const movieIdsByCinemaId = new Map();
  for (const schedule of schedules) {
    const cinemaId = cinemaIdByRoomId.get(schedule.room_id);
    if (!cinemaId) continue;
    cinemaIdByScheduleId.set(schedule.id, cinemaId);
    const movieIds = movieIdsByCinemaId.get(cinemaId) || new Set();
    movieIds.add(schedule.movie_id);
    movieIdsByCinemaId.set(cinemaId, movieIds);
  }

  const scheduleIds = schedules.map((s) => s.id);
  const soldTickets = await Ticket.find({ schedule_id: { $in: scheduleIds }, status: 0 });
  const bookingCountByCinemaId = new Map();
  for (const ticket of soldTickets) {
    const cinemaId = cinemaIdByScheduleId.get(ticket.schedule_id);
    if (!cinemaId) continue;
    bookingCountByCinemaId.set(cinemaId, (bookingCountByCinemaId.get(cinemaId) || 0) + 1);
  }

  const allMovieIds = [...new Set(schedules.map((s) => s.movie_id))];
  const reviews = await Review.find({ movie_id: { $in: allMovieIds }, hidden: false });
  const ratingsByMovieId = new Map();
  for (const review of reviews) {
    const list = ratingsByMovieId.get(review.movie_id) || [];
    list.push(review.rating);
    ratingsByMovieId.set(review.movie_id, list);
  }

  const result = cinemas.map((cinema) => {
    const movieIds = [...(movieIdsByCinemaId.get(cinema.id) || [])];
    const ratings = movieIds.flatMap((movieId) => ratingsByMovieId.get(movieId) || []);
    const avgRating = ratings.length
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
      : 0;
    return {
      id: cinema.id,
      name: cinema.name,
      address: cinema.address,
      city: cinema.city,
      images: cinema.images,
      bookingCount: bookingCountByCinemaId.get(cinema.id) || 0,
      avgRating,
      reviewCount: ratings.length,
    };
  });

  result.sort((a, b) => b.bookingCount - a.bookingCount || b.avgRating - a.avgRating);
  return result.slice(0, 8);
}

async function findFavoriteCinemasByAccountId(accountId) {
  const favorites = await FavoriteCinema.find({ account_id: accountId }).sort({ id: -1 });
  const cinemaIds = favorites.map((f) => f.cinema_id);
  const cinemas = await Cinema.find({ id: { $in: cinemaIds } });
  const cinemaById = new Map(cinemas.map((c) => [c.id, c]));
  return favorites.map((f) => cinemaById.get(f.cinema_id)).filter(Boolean);
}

async function countFavorites(cinemaId) {
  return FavoriteCinema.countDocuments({ cinema_id: Number(cinemaId) });
}

async function findFavorite({ cinemaId, accountId }) {
  return FavoriteCinema.findOne({ cinema_id: Number(cinemaId), account_id: accountId });
}

async function createFavorite({ id, cinemaId, accountId }) {
  return FavoriteCinema.create({ id, cinema_id: Number(cinemaId), account_id: accountId });
}

async function deleteFavorite({ cinemaId, accountId }) {
  return FavoriteCinema.deleteOne({ cinema_id: Number(cinemaId), account_id: accountId });
}

async function findById(id) {
  return Cinema.findOne({ id: Number(id) });
}

async function findAccountByEmail(email) {
  return Account.findOne({ email: String(email).toLowerCase() });
}

// Creates the owner's cinema if this is their first submission, otherwise updates it in place.
async function upsertOnboard(account, { name, address, city, images }) {
  let cinema = await Cinema.findOne({ owner_id: account.id });
  if (cinema) {
    cinema.name = name;
    cinema.address = address || '';
    cinema.city = city || '';
    if (Array.isArray(images)) cinema.images = images;
    await cinema.save();
  } else {
    const id = await nextId('cinema');
    cinema = await Cinema.create({
      id,
      owner_id: account.id,
      name,
      address: address || '',
      city: city || '',
      images: Array.isArray(images) ? images : [],
      status: 0,
    });
  }
  return cinema;
}

async function create(data) {
  return Cinema.create(data);
}

async function updateFields(id, updates) {
  return Cinema.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function approve(id) {
  return Cinema.findOneAndUpdate({ id: Number(id) }, { $set: { status: 1 } }, { new: true });
}

async function block(id) {
  return Cinema.findOneAndUpdate({ id: Number(id) }, { $set: { status: 2 } }, { new: true });
}

async function setAccountApproved(accountId) {
  return Account.updateOne({ id: accountId }, { $set: { approved: true } });
}

async function remove(id) {
  return Cinema.deleteOne({ id: Number(id) });
}

module.exports = {
  findApproved,
  findMine,
  findPending,
  getTopRanked,
  findFavoriteCinemasByAccountId,
  countFavorites,
  findFavorite,
  createFavorite,
  deleteFavorite,
  findById,
  findAccountByEmail,
  upsertOnboard,
  create,
  updateFields,
  approve,
  block,
  setAccountApproved,
  remove,
};
