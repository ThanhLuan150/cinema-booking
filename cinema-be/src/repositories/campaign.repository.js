const Campaign = require('../models/Campaign');
const CampaignBanner = require('../models/CampaignBanner');
const Account = require('../models/Account');
const Booking = require('../models/Booking');
const FavoriteCinema = require('../models/FavoriteCinema');
const Branch = require('../models/Branch');

// ---- Campaigns -------------------------------------------------------------

// Branch ids this account owns (a Branch Admin can own more than one). Used to scope the
// management list for a BRANCH-scoped caller.
async function findOwnedCinemaIds(accountId) {
  const owned = await Branch.find({ owner_id: Number(accountId) }, { id: 1 });
  return owned.map((b) => b.id);
}


async function findFiltered(filter = {}, { skip = 0, limit = 20 } = {}) {
  const [data, total] = await Promise.all([
    Campaign.find(filter).sort({ start_at: -1, id: -1 }).skip(skip).limit(limit),
    Campaign.countDocuments(filter),
  ]);
  return { data, total };
}

async function findById(id) {
  return Campaign.findOne({ id: Number(id) });
}

// The branch a campaign belongs to, for requireBranchAccess. Returns `null` both for "no such
// campaign" and for a Global Campaign — the route resolvers distinguish the two themselves,
// because a Global Campaign must not be reachable through the branch gate at all.
async function findBranchIdByCampaignId(id) {
  const campaign = await Campaign.findOne({ id: Number(id) });
  return campaign ? campaign.branch_id : null;
}

// Candidate rows for a customer-facing feed. `branchIds` restricts to those branches plus every
// Global Campaign (branch_id null), which by definition runs everywhere.
async function findVisibleCandidates(windowFilter, { branchId = null, includeGlobal = true, limit = 50 } = {}) {
  const scope = [];
  if (branchId !== null && branchId !== undefined) scope.push({ branch_id: Number(branchId) });
  if (includeGlobal) scope.push({ branch_id: null });

  const filter = { ...windowFilter };
  if (scope.length > 0) filter.$or = scope;

  return Campaign.find(filter).sort({ start_at: -1, id: -1 }).limit(limit);
}

async function create(data) {
  return Campaign.create(data);
}

async function updateFields(id, updates) {
  return Campaign.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Campaign.deleteOne({ id: Number(id) });
}

// Records one completed notification blast. `$inc` keeps a concurrent second dispatch from
// clobbering the first one's tally.
async function recordNotificationDispatch(id, { sentCount, at = new Date() }) {
  return Campaign.findOneAndUpdate(
    { id: Number(id) },
    { $set: { notification_last_sent_at: at }, $inc: { notification_sent_count: sentCount } },
    { new: true },
  );
}

// ---- Banners ---------------------------------------------------------------

async function findBanners(filter = {}, { skip = 0, limit = 50 } = {}) {
  const [data, total] = await Promise.all([
    CampaignBanner.find(filter).sort({ sort_order: 1, id: 1 }).skip(skip).limit(limit),
    CampaignBanner.countDocuments(filter),
  ]);
  return { data, total };
}

async function findBannerById(id) {
  return CampaignBanner.findOne({ id: Number(id) });
}

async function findBannersByCampaignIds(campaignIds, { activeOnly = false } = {}) {
  const filter = { campaign_id: { $in: campaignIds.map(Number) } };
  if (activeOnly) filter.status = 'ACTIVE';
  return CampaignBanner.find(filter).sort({ sort_order: 1, id: 1 });
}

async function createBanner(data) {
  return CampaignBanner.create(data);
}

async function updateBanner(id, updates) {
  return CampaignBanner.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function removeBanner(id) {
  return CampaignBanner.deleteOne({ id: Number(id) });
}

// Deleting a campaign takes its banners with it — a banner has no meaning without one.
async function removeBannersForCampaign(campaignId) {
  return CampaignBanner.deleteMany({ campaign_id: Number(campaignId) });
}

// ---- Audience --------------------------------------------------------------
async function findAudienceAccountIds({ targetType, branchId = null }) {
  const base = { role: 1, status: 1, verified: true };

  if (targetType === Campaign.TARGET_TYPE.MEMBERS) {
    base.membership_level = { $ne: 'NONE' };
  }

  if (targetType === Campaign.TARGET_TYPE.BRANCH_CUSTOMERS && branchId !== null && branchId !== undefined) {
    const [bookingIds, favouriteIds] = await Promise.all([
      Booking.distinct('account_id', { branch_id: Number(branchId) }),
      FavoriteCinema.distinct('account_id', { cinema_id: Number(branchId) }),
    ]);
    const ids = [...new Set([...bookingIds, ...favouriteIds].map(Number))];
    if (ids.length === 0) return [];
    base.id = { $in: ids };
  }

  const accounts = await Account.find(base).select('id');
  return accounts.map((a) => a.id);
}

module.exports = {
  findOwnedCinemaIds,
  findFiltered,
  findById,
  findBranchIdByCampaignId,
  findVisibleCandidates,
  create,
  updateFields,
  remove,
  recordNotificationDispatch,
  findBanners,
  findBannerById,
  findBannersByCampaignIds,
  createBanner,
  updateBanner,
  removeBanner,
  removeBannersForCampaign,
  findAudienceAccountIds,
};
