const Branch = require('../models/Branch');
const Account = require('../models/Account');
const FavoriteCinema = require('../models/FavoriteCinema');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Review = require('../models/Review');
const Employee = require('../models/Employee');

async function findActive({ skip = 0, limit = 20 } = {}) {
  const filter = { status: 'ACTIVE' };
  const [data, total] = await Promise.all([
    Branch.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Branch.countDocuments(filter),
  ]);
  return { data, total };
}

async function findMine({ role, accountId, skip = 0, limit = 20 }) {
  // Super Admin (role 0) sees every branch, across every company. Everyone else
  // (Branch Admin) is scoped to only the branch(es) they've been assigned as owner.
  const filter = role === 0 ? {} : { owner_id: accountId };
  const [data, total] = await Promise.all([
    Branch.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Branch.countDocuments(filter),
  ]);

  if (role !== 0) return { data, total };

  // Admin view: attach each branch's owner contact info so the admin Branches list can show
  // the assigned Branch Admin's name/avatar instead of just a bare owner_id number.
  const ownerIds = [...new Set(data.map((branch) => branch.owner_id))];
  const owners = await Account.find({ id: { $in: ownerIds } });
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  const enriched = data.map((branch) => {
    const owner = ownerById.get(branch.owner_id);
    return {
      ...branch.toJSON(),
      owner_name: owner?.name || '',
      owner_phone: owner?.phone || '',
      owner_avatar: owner?.avatar || '',
    };
  });

  return { data: enriched, total };
}

// Active branches ranked by ticket booking volume, enriched with the average customer
// rating across the movies they've screened.
async function getTopRanked() {
  const branches = await Branch.find({ status: 'ACTIVE' }).sort({ id: -1 });
  const branchIds = branches.map((c) => c.id);

  const rooms = await Room.find({ cinema_id: { $in: branchIds } });
  const branchIdByRoomId = new Map(rooms.map((r) => [r.id, r.cinema_id]));
  const roomIds = rooms.map((r) => r.id);

  const schedules = await Schedule.find({ room_id: { $in: roomIds } });
  const branchIdByScheduleId = new Map();
  const movieIdsByBranchId = new Map();
  for (const schedule of schedules) {
    const branchId = branchIdByRoomId.get(schedule.room_id);
    if (!branchId) continue;
    branchIdByScheduleId.set(schedule.id, branchId);
    const movieIds = movieIdsByBranchId.get(branchId) || new Set();
    movieIds.add(schedule.movie_id);
    movieIdsByBranchId.set(branchId, movieIds);
  }

  const scheduleIds = schedules.map((s) => s.id);
  const soldTickets = await Ticket.find({ schedule_id: { $in: scheduleIds }, status: 0 });
  const bookingCountByBranchId = new Map();
  for (const ticket of soldTickets) {
    const branchId = branchIdByScheduleId.get(ticket.schedule_id);
    if (!branchId) continue;
    bookingCountByBranchId.set(branchId, (bookingCountByBranchId.get(branchId) || 0) + 1);
  }

  const allMovieIds = [...new Set(schedules.map((s) => s.movie_id))];
  const reviews = await Review.find({ movie_id: { $in: allMovieIds }, hidden: false });
  const ratingsByMovieId = new Map();
  for (const review of reviews) {
    const list = ratingsByMovieId.get(review.movie_id) || [];
    list.push(review.rating);
    ratingsByMovieId.set(review.movie_id, list);
  }

  const result = branches.map((branch) => {
    const movieIds = [...(movieIdsByBranchId.get(branch.id) || [])];
    const ratings = movieIds.flatMap((movieId) => ratingsByMovieId.get(movieId) || []);
    const avgRating = ratings.length
      ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
      : 0;
    return {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      city: branch.city,
      images: branch.images,
      bookingCount: bookingCountByBranchId.get(branch.id) || 0,
      avgRating,
      reviewCount: ratings.length,
    };
  });

  result.sort((a, b) => b.bookingCount - a.bookingCount || b.avgRating - a.avgRating);
  return result.slice(0, 8);
}

async function findFavoriteBranchesByAccountId(accountId) {
  const favorites = await FavoriteCinema.find({ account_id: accountId }).sort({ id: -1 });
  const branchIds = favorites.map((f) => f.cinema_id);
  const branches = await Branch.find({ id: { $in: branchIds }, status: 'ACTIVE' });
  const branchById = new Map(branches.map((c) => [c.id, c]));
  return favorites.map((f) => branchById.get(f.cinema_id)).filter(Boolean);
}

async function countFavorites(branchId) {
  return FavoriteCinema.countDocuments({ cinema_id: Number(branchId) });
}

async function findFavorite({ branchId, accountId }) {
  return FavoriteCinema.findOne({ cinema_id: Number(branchId), account_id: accountId });
}

async function createFavorite({ id, branchId, accountId }) {
  return FavoriteCinema.create({ id, cinema_id: Number(branchId), account_id: accountId });
}

async function deleteFavorite({ branchId, accountId }) {
  return FavoriteCinema.deleteOne({ cinema_id: Number(branchId), account_id: accountId });
}

async function findById(id) {
  return Branch.findOne({ id: Number(id) });
}

async function findActiveById(id) {
  return Branch.findOne({ id: Number(id), status: 'ACTIVE' });
}

async function findAccountByEmail(email) {
  return Account.findOne({ email: String(email).toLowerCase() });
}

// Provisions a Branch Admin account directly (super admin action) — pre-approved and
// pre-verified, unlike the old self-registration + OTP + admin-approval flow.
async function createOwnerAccount({ id, email, password, name, phone }) {
  return Account.create({
    id,
    email,
    password,
    name: name || '',
    phone: phone || '',
    role: 2,
    status: 1,
    approved: true,
    verified: true,
  });
}

async function create(data) {
  return Branch.create(data);
}

async function updateFields(id, updates) {
  return Branch.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function setStatus(id, status) {
  return Branch.findOneAndUpdate({ id: Number(id) }, { $set: { status } }, { new: true });
}

async function assignAdmin(id, accountId) {
  return Branch.findOneAndUpdate({ id: Number(id) }, { $set: { owner_id: Number(accountId) } }, { new: true });
}

async function setAccountApproved(accountId) {
  return Account.updateOne({ id: accountId }, { $set: { approved: true } });
}

// A branch may only be deleted while it has no active staff and no rooms attached — those
// would otherwise be orphaned (dangling branch_id/cinema_id references).
async function hasDependents(id) {
  const branchId = Number(id);
  const [employeeCount, roomCount] = await Promise.all([
    Employee.countDocuments({ branch_id: branchId, status: 1 }),
    Room.countDocuments({ cinema_id: branchId }),
  ]);
  return employeeCount > 0 || roomCount > 0;
}

async function remove(id) {
  return Branch.deleteOne({ id: Number(id) });
}

module.exports = {
  findActive,
  findMine,
  getTopRanked,
  findFavoriteBranchesByAccountId,
  countFavorites,
  findFavorite,
  createFavorite,
  deleteFavorite,
  findById,
  findActiveById,
  findAccountByEmail,
  createOwnerAccount,
  create,
  updateFields,
  setStatus,
  assignAdmin,
  setAccountApproved,
  hasDependents,
  remove,
};
