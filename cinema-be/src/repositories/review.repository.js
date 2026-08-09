const Review = require('../models/Review');
const Movie = require('../models/Movie');
const Branch = require('../models/Branch');
const Account = require('../models/Account');

async function findAccountsByIds(ids) {
  const accounts = await Account.find({ id: { $in: ids } }, 'id name avatar');
  return new Map(accounts.map((a) => [a.id, { id: a.id, name: a.name, avatar: a.avatar }]));
}

function summarizeReactions(reactions, viewerAccountId) {
  const counts = {};
  let mine = null;
  for (const r of reactions || []) {
    counts[r.type] = (counts[r.type] || 0) + 1;
    if (viewerAccountId != null && r.account_id === viewerAccountId) mine = r.type;
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { counts, total, mine };
}

// Groups a flat list of top-level reviews + replies into threads, attaches author info and
// reaction summaries, and computes the average/count from top-level (rated) reviews only.
async function buildThread(reviews, viewerAccountId) {
  const accountIds = [...new Set(reviews.map((r) => r.account_id))];
  const accountsById = await findAccountsByIds(accountIds);
  const fallbackAuthor = { id: 0, name: '', avatar: '' };

  const toEntry = (r) => {
    const json = r.toJSON();
    delete json.reports;
    return {
      ...json,
      author: accountsById.get(r.account_id) || fallbackAuthor,
      reactions: summarizeReactions(r.reactions, viewerAccountId),
      reportedByMe: viewerAccountId != null && (r.reports || []).some((rep) => rep.account_id === viewerAccountId),
    };
  };

  const topLevel = reviews.filter((r) => r.parent_id == null);
  const repliesByParent = new Map();
  for (const r of reviews) {
    if (r.parent_id == null) continue;
    if (!repliesByParent.has(r.parent_id)) repliesByParent.set(r.parent_id, []);
    repliesByParent.get(r.parent_id).push(r);
  }

  const threaded = topLevel
    .map((r) => ({
      ...toEntry(r),
      replies: (repliesByParent.get(r.id) || [])
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(toEntry),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const rated = topLevel.filter((r) => r.rating != null);
  const average = rated.length
    ? Math.round((rated.reduce((sum, r) => sum + r.rating, 0) / rated.length) * 10) / 10
    : 0;

  return { reviews: threaded, average, count: rated.length };
}

// All reviews including hidden ones, joined with movie/cinema name (admin moderation view)
async function findAllForModeration({ skip = 0, limit = 20 } = {}) {
  const [reviews, total] = await Promise.all([
    Review.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments(),
  ]);
  const movieIds = [...new Set(reviews.filter((r) => r.movie_id != null).map((r) => r.movie_id))];
  const branchIds = [...new Set(reviews.filter((r) => r.cinema_id != null).map((r) => r.cinema_id))];
  const movies = await Movie.find({ id: { $in: movieIds } });
  const cinemas = await Branch.find({ id: { $in: branchIds } });
  const movieById = new Map(movies.map((m) => [m.id, m]));
  const cinemaById = new Map(cinemas.map((c) => [c.id, c]));

  const data = reviews.map((r) => ({
    ...r.toJSON(),
    movie: r.movie_id != null && movieById.get(r.movie_id) ? { name: movieById.get(r.movie_id).name } : null,
    cinema: r.cinema_id != null && cinemaById.get(r.cinema_id) ? { name: cinemaById.get(r.cinema_id).name } : null,
    reportCount: (r.reports || []).length,
  }));
  return { data, total };
}

async function findVisibleByCinemaId(branchId, viewerAccountId) {
  const reviews = await Review.find({ cinema_id: Number(branchId), hidden: false });
  return buildThread(reviews, viewerAccountId);
}

async function findVisibleByMovieId(movieId, viewerAccountId) {
  const reviews = await Review.find({ movie_id: Number(movieId), hidden: false });
  return buildThread(reviews, viewerAccountId);
}

async function findOwn(target, accountId) {
  return Review.findOne({ ...target, account_id: accountId, parent_id: null });
}

async function create(data) {
  return Review.create(data);
}

async function saveExisting(review, { rating, comment }) {
  review.rating = rating;
  review.comment = comment || '';
  await review.save();
  return review;
}

async function hide(id) {
  return Review.findOneAndUpdate({ id: Number(id) }, { $set: { hidden: true } }, { new: true });
}

async function findById(id) {
  return Review.findOne({ id: Number(id) });
}

async function remove(id) {
  return Review.deleteOne({ id: Number(id) });
}

// Toggles the caller's reaction on a review: same type again removes it, a different type
// replaces it, no existing reaction adds it.
async function react(id, accountId, type) {
  const review = await Review.findOne({ id: Number(id) });
  if (!review) return null;

  const idx = review.reactions.findIndex((r) => r.account_id === accountId);
  if (idx >= 0 && review.reactions[idx].type === type) {
    review.reactions.splice(idx, 1);
  } else if (idx >= 0) {
    review.reactions[idx].type = type;
  } else {
    review.reactions.push({ account_id: accountId, type });
  }
  await review.save();
  return review;
}

// Adds or replaces the caller's report entry (one report per reporter per review).
async function report(id, accountId, reason) {
  const review = await Review.findOne({ id: Number(id) });
  if (!review) return null;

  const idx = review.reports.findIndex((r) => r.account_id === accountId);
  if (idx >= 0) {
    review.reports[idx].reason = reason;
  } else {
    review.reports.push({ account_id: accountId, reason });
  }
  await review.save();
  return review;
}

module.exports = {
  findAllForModeration,
  findVisibleByCinemaId,
  findVisibleByMovieId,
  findOwn,
  create,
  saveExisting,
  hide,
  findById,
  remove,
  react,
  report,
};
