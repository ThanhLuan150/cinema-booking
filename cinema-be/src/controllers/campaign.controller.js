const Campaign = require('../models/Campaign');
const CampaignBanner = require('../models/CampaignBanner');
const AuditLog = require('../models/AuditLog');
const campaignRepository = require('../repositories/campaign.repository');
const movieRepository = require('../repositories/movie.repository');
const promotionRepository = require('../repositories/promotion.repository');
const branchRepository = require('../repositories/branch.repository');
const campaignService = require('../services/campaign.service');
const { recordAudit } = require('../services/auditLog.service');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { evaluateCampaign, STATE } = require('../utils/campaignWindow');

const STATUSES = Object.values(Campaign.STATUS);
const TARGET_TYPES = Object.values(Campaign.TARGET_TYPE);
const BANNER_PLACEMENTS = Object.values(CampaignBanner.PLACEMENT);
const BANNER_STATUSES = Object.values(CampaignBanner.STATUS);

// ---- Scope helpers ----------------------------------------------------------
// A Global Campaign (branch_id null) is SUPER_ADMIN territory: `requireBranchAccess` cannot
// guard it, because there is no branch to check. These helpers are what stand in for it —
// every write path runs the campaign through `assertCanManage` before touching it.

function isGlobal(campaign) {
  return campaign.branch_id === null || campaign.branch_id === undefined;
}

// Parses the branch a *new* campaign is being filed under. `''`/absent means Global.
function parseBranchId(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

// May this caller manage this campaign? ALL scope may manage anything; a BRANCH-scoped caller
// may never touch a Global Campaign, and only their own branch's rows.
async function canManage(req, campaign) {
  if (req.permissionScope === 'ALL') return true;
  if (isGlobal(campaign)) return false;
  return ownsBranch(req, campaign.branch_id);
}

async function ownsBranch(req, branchId) {
  const branch = await branchRepository.findById(branchId);
  if (!branch) return false;
  return branch.owner_id === req.account.accountId;
}

function forbidden(res, message = 'Forbidden') {
  return res.status(403).json({ message });
}

// ---- Validation -------------------------------------------------------------

function parseWindow({ start_at, end_at }) {
  const start = new Date(start_at);
  const end = new Date(end_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'start_at and end_at must be valid dates', code: 'INVALID_CAMPAIGN_WINDOW' };
  }
  if (start >= end) {
    return { error: 'start_at must be before end_at', code: 'INVALID_CAMPAIGN_WINDOW' };
  }
  return { start, end };
}

// Validates a list of linked ids against its catalogue, so a campaign can never point at a
// movie or promotion that does not exist. Returns the de-duplicated numeric ids.
async function resolveLinkIds(raw, findById, label) {
  if (raw === undefined) return { ids: undefined };
  if (!Array.isArray(raw)) return { error: `${label} must be an array of ids`, code: 'INVALID_LINK_LIST' };

  const ids = [...new Set(raw.map(Number))];
  if (ids.some((id) => !Number.isFinite(id))) {
    return { error: `${label} must contain only numeric ids`, code: 'INVALID_LINK_LIST' };
  }

  for (const id of ids) {
    if (!(await findById(id))) {
      return { error: `${label}: ${id} not found`, code: 'LINK_NOT_FOUND' };
    }
  }
  return { ids };
}

// ---- Campaigns --------------------------------------------------------------

// GET /api/campaigns?branchId=|global=&status=&state=&page=&limit= (campaign.read)
// - ALL scope: every campaign, optionally narrowed by branchId, or `global=true` for the
//   company-wide ones only.
// - BRANCH scope: silently constrained to the branches this admin owns; a Global Campaign is
//   visible read-only (they run at every branch) but never editable — see assertCanManage.
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};

  const requestedBranchId = parseBranchId(req.query.branchId);
  if (requestedBranchId === undefined) {
    return res.status(400).json({ message: 'branchId must be a number' });
  }

  if (req.permissionScope === 'ALL') {
    if (req.query.global === 'true') filter.branch_id = null;
    else if (req.query.branchId !== undefined && req.query.branchId !== '') filter.branch_id = requestedBranchId;
  } else {
    const ownedIds = await campaignRepository.findOwnedCinemaIds(req.account.accountId);
    if (req.query.branchId !== undefined && req.query.branchId !== '') {
      if (!ownedIds.includes(requestedBranchId)) return forbidden(res);
      filter.branch_id = requestedBranchId;
    } else {
      // Their own branches, plus the Global Campaigns that also run at those branches.
      filter.$or = [{ branch_id: { $in: ownedIds } }, { branch_id: null }];
    }
  }

  if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.targetType && TARGET_TYPES.includes(req.query.targetType)) filter.target_type = req.query.targetType;

  const { data, total } = await campaignRepository.findFiltered(filter, { skip, limit });
  const now = new Date();
  let rows = data.map((c) => campaignService.withDerivedState(c, now));

  // `state` filters on the *derived* state (e.g. only what is running, or only what expired).
  // It is applied after the query because the state is computed, never stored.
  if (req.query.state && Object.values(STATE).includes(req.query.state)) {
    rows = rows.filter((c) => c.display_state === req.query.state);
  }

  res.json(buildPaginatedResult({ data: rows, total, page, limit }));
}

// GET /api/campaigns/:id (campaign.read) — the campaign with its banners and resolved links.
async function getById(req, res) {
  const campaign = await campaignRepository.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!(await canRead(req, campaign))) return forbidden(res);

  const [{ data: banners }, links] = await Promise.all([
    campaignRepository.findBanners({ campaign_id: campaign.id }),
    campaignService.loadLinks(campaign),
  ]);

  res.json({ ...campaignService.withDerivedState(campaign), banners, links });
}

// Reading is looser than managing: a Branch Admin may read a Global Campaign (it runs at their
// branch, so they need to see it) but may not edit it.
async function canRead(req, campaign) {
  if (req.permissionScope === 'ALL') return true;
  if (isGlobal(campaign)) return true;
  return ownsBranch(req, campaign.branch_id);
}

// POST /api/campaigns (campaign.manage)
// { name, description?, start_at, end_at, status?, target_type?, branch_id?, movie_ids?,
//   promotion_ids?, notification_enabled?, notification_title?, notification_body? }
async function create(req, res) {
  const name = req.body.name ? String(req.body.name).trim() : '';
  if (!name) return res.status(400).json({ message: 'name is required' });

  const branch_id = parseBranchId(req.body.branch_id);
  if (branch_id === undefined) return res.status(400).json({ message: 'branch_id must be a number' });

  // Only a SUPER_ADMIN manages Global Campaigns; a Branch Admin files under a branch they own.
  if (branch_id === null) {
    if (req.permissionScope !== 'ALL') {
      return forbidden(res, 'Only a super admin can manage a Global Campaign');
    }
  } else if (req.permissionScope !== 'ALL' && !(await ownsBranch(req, branch_id))) {
    return forbidden(res);
  } else if (!(await branchRepository.findById(branch_id))) {
    return res.status(404).json({ message: 'Branch not found' });
  }

  const window = parseWindow(req.body);
  if (window.error) return res.status(400).json({ message: window.error, code: window.code });

  if (req.body.status !== undefined && !STATUSES.includes(req.body.status)) {
    return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
  }
  if (req.body.target_type !== undefined && !TARGET_TYPES.includes(req.body.target_type)) {
    return res
      .status(400)
      .json({ message: `target_type must be one of ${TARGET_TYPES.join(', ')}`, code: 'INVALID_TARGET_TYPE' });
  }

  const movies = await resolveLinkIds(req.body.movie_ids, (id) => movieRepository.findById(id), 'movie_ids');
  if (movies.error) return res.status(400).json({ message: movies.error, code: movies.code });
  const promos = await resolveLinkIds(req.body.promotion_ids, (id) => promotionRepository.findById(id), 'promotion_ids');
  if (promos.error) return res.status(400).json({ message: promos.error, code: promos.code });

  const id = await nextId('campaign');
  const campaign = await campaignRepository.create({
    id,
    name,
    description: req.body.description ? String(req.body.description).trim() : '',
    start_at: window.start,
    end_at: window.end,
    status: req.body.status || Campaign.STATUS.DRAFT,
    target_type: req.body.target_type || Campaign.TARGET_TYPE.ALL_CUSTOMERS,
    branch_id,
    movie_ids: movies.ids || [],
    promotion_ids: promos.ids || [],
    notification_enabled: Boolean(req.body.notification_enabled),
    notification_title: req.body.notification_title ? String(req.body.notification_title).trim() : '',
    notification_body: req.body.notification_body ? String(req.body.notification_body).trim() : '',
    created_by: req.account.accountId,
  });

  await recordAudit({
    req,
    action: AuditLog.ACTION.CAMPAIGN_CREATED,
    entityType: AuditLog.ENTITY_TYPE.CAMPAIGN,
    entityId: campaign.id,
    branchId: branch_id,
    metadata: { name: campaign.name, status: campaign.status, target_type: campaign.target_type },
  });

  res.status(201).json(campaignService.withDerivedState(campaign));
}

// PUT /api/campaigns/:id (campaign.manage). `branch_id` is immutable — moving a campaign across
// branches would silently change who owns its banners and its audience, so it is a new campaign.
async function update(req, res) {
  const campaign = await campaignRepository.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!(await canManage(req, campaign))) {
    return forbidden(res, isGlobal(campaign) ? 'Only a super admin can manage a Global Campaign' : 'Forbidden');
  }

  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body.description !== undefined) updates.description = String(req.body.description || '').trim();

  if (req.body.start_at !== undefined || req.body.end_at !== undefined) {
    const window = parseWindow({
      start_at: req.body.start_at !== undefined ? req.body.start_at : campaign.start_at,
      end_at: req.body.end_at !== undefined ? req.body.end_at : campaign.end_at,
    });
    if (window.error) return res.status(400).json({ message: window.error, code: window.code });
    updates.start_at = window.start;
    updates.end_at = window.end;
  }

  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    updates.status = req.body.status;
  }
  if (req.body.target_type !== undefined) {
    if (!TARGET_TYPES.includes(req.body.target_type)) {
      return res
        .status(400)
        .json({ message: `target_type must be one of ${TARGET_TYPES.join(', ')}`, code: 'INVALID_TARGET_TYPE' });
    }
    updates.target_type = req.body.target_type;
  }

  const movies = await resolveLinkIds(req.body.movie_ids, (id) => movieRepository.findById(id), 'movie_ids');
  if (movies.error) return res.status(400).json({ message: movies.error, code: movies.code });
  if (movies.ids !== undefined) updates.movie_ids = movies.ids;

  const promos = await resolveLinkIds(req.body.promotion_ids, (id) => promotionRepository.findById(id), 'promotion_ids');
  if (promos.error) return res.status(400).json({ message: promos.error, code: promos.code });
  if (promos.ids !== undefined) updates.promotion_ids = promos.ids;

  if (req.body.notification_enabled !== undefined) {
    updates.notification_enabled = Boolean(req.body.notification_enabled);
  }
  if (req.body.notification_title !== undefined) {
    updates.notification_title = String(req.body.notification_title || '').trim();
  }
  if (req.body.notification_body !== undefined) {
    updates.notification_body = String(req.body.notification_body || '').trim();
  }

  const updated = await campaignRepository.updateFields(campaign.id, updates);

  // A status change is the one edit that flips a campaign on or off for customers, so it gets
  // its own audit action with the before/after recorded.
  const statusChanged = updates.status !== undefined && updates.status !== campaign.status;
  await recordAudit({
    req,
    action: statusChanged ? AuditLog.ACTION.CAMPAIGN_STATUS_CHANGED : AuditLog.ACTION.CAMPAIGN_UPDATED,
    entityType: AuditLog.ENTITY_TYPE.CAMPAIGN,
    entityId: campaign.id,
    branchId: campaign.branch_id,
    metadata: statusChanged
      ? { name: updated.name, from: campaign.status, to: updated.status }
      : { name: updated.name, fields: Object.keys(updates) },
  });

  res.json(campaignService.withDerivedState(updated));
}

// DELETE /api/campaigns/:id (campaign.manage) — takes the campaign's banners with it, since a
// banner has no meaning outside its campaign. Linked movies/promotions are untouched: the
// campaign only ever pointed at them.
async function remove(req, res) {
  const campaign = await campaignRepository.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!(await canManage(req, campaign))) {
    return forbidden(res, isGlobal(campaign) ? 'Only a super admin can manage a Global Campaign' : 'Forbidden');
  }

  const { deletedCount } = await campaignRepository.removeBannersForCampaign(campaign.id);
  await campaignRepository.remove(campaign.id);

  await recordAudit({
    req,
    action: AuditLog.ACTION.CAMPAIGN_DELETED,
    entityType: AuditLog.ENTITY_TYPE.CAMPAIGN,
    entityId: campaign.id,
    branchId: campaign.branch_id,
    metadata: { name: campaign.name, banners_removed: deletedCount ?? 0 },
  });

  res.json({ message: 'Deleted' });
}

// POST /api/campaigns/:id/notify (campaign.notify) — blast the campaign's announcement to its
// target audience. Safe to call twice: recipients already reached are skipped, not re-notified.
async function notify(req, res) {
  const campaign = await campaignRepository.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!(await canManage(req, campaign))) {
    return forbidden(res, isGlobal(campaign) ? 'Only a super admin can manage a Global Campaign' : 'Forbidden');
  }

  const result = await campaignService.dispatchCampaignNotification(campaign);
  if (result.error) return res.status(400).json({ message: result.error, code: result.code });

  await recordAudit({
    req,
    action: AuditLog.ACTION.CAMPAIGN_NOTIFICATION_SENT,
    entityType: AuditLog.ENTITY_TYPE.CAMPAIGN,
    entityId: campaign.id,
    branchId: campaign.branch_id,
    metadata: {
      name: campaign.name,
      target_type: campaign.target_type,
      audience: result.audience,
      sent: result.sent,
      skipped: result.skipped,
    },
  });

  res.json(result);
}

// ---- Banners ----------------------------------------------------------------

// GET /api/campaigns/:id/banners (campaign.read)
async function listBanners(req, res) {
  const campaign = await campaignRepository.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!(await canRead(req, campaign))) return forbidden(res);

  const { data } = await campaignRepository.findBanners({ campaign_id: campaign.id }, { limit: 100 });
  res.json({ data });
}

// POST /api/campaigns/:id/banners { title, image_url, subtitle?, link_url?, placement?,
// sort_order?, status? } (campaign.manage)
async function createBanner(req, res) {
  const campaign = await campaignRepository.findById(req.params.id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!(await canManage(req, campaign))) {
    return forbidden(res, isGlobal(campaign) ? 'Only a super admin can manage a Global Campaign' : 'Forbidden');
  }

  const title = req.body.title ? String(req.body.title).trim() : '';
  if (!title) return res.status(400).json({ message: 'title is required' });
  const image_url = req.body.image_url ? String(req.body.image_url).trim() : '';
  if (!image_url) return res.status(400).json({ message: 'image_url is required' });

  const fields = validateBannerOptionals(req.body);
  if (fields.error) return res.status(400).json({ message: fields.error, code: fields.code });

  const id = await nextId('campaignBanner');
  const banner = await campaignRepository.createBanner({
    id,
    campaign_id: campaign.id,
    title,
    image_url,
    subtitle: req.body.subtitle ? String(req.body.subtitle).trim() : '',
    link_url: req.body.link_url ? String(req.body.link_url).trim() : '',
    placement: fields.placement || CampaignBanner.PLACEMENT.HOME_STRIP,
    sort_order: fields.sort_order ?? 0,
    status: fields.status || CampaignBanner.STATUS.ACTIVE,
  });

  await recordAudit({
    req,
    action: AuditLog.ACTION.CAMPAIGN_BANNER_CREATED,
    entityType: AuditLog.ENTITY_TYPE.CAMPAIGN,
    entityId: campaign.id,
    branchId: campaign.branch_id,
    metadata: { banner_id: banner.id, title: banner.title, placement: banner.placement },
  });

  res.status(201).json(banner);
}

// PUT /api/campaigns/banners/:bannerId (campaign.manage). `campaign_id` is immutable so a banner
// can never be re-parented out of the campaign whose permissions guard it.
async function updateBanner(req, res) {
  const banner = await campaignRepository.findBannerById(req.params.bannerId);
  if (!banner) return res.status(404).json({ message: 'Banner not found' });

  const campaign = await campaignRepository.findById(banner.campaign_id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!(await canManage(req, campaign))) {
    return forbidden(res, isGlobal(campaign) ? 'Only a super admin can manage a Global Campaign' : 'Forbidden');
  }

  const updates = {};
  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) return res.status(400).json({ message: 'title cannot be empty' });
    updates.title = title;
  }
  if (req.body.image_url !== undefined) {
    const image_url = String(req.body.image_url).trim();
    if (!image_url) return res.status(400).json({ message: 'image_url cannot be empty' });
    updates.image_url = image_url;
  }
  if (req.body.subtitle !== undefined) updates.subtitle = String(req.body.subtitle || '').trim();
  if (req.body.link_url !== undefined) updates.link_url = String(req.body.link_url || '').trim();

  const fields = validateBannerOptionals(req.body);
  if (fields.error) return res.status(400).json({ message: fields.error, code: fields.code });
  if (fields.placement) updates.placement = fields.placement;
  if (fields.sort_order !== undefined) updates.sort_order = fields.sort_order;
  if (fields.status) updates.status = fields.status;

  const updated = await campaignRepository.updateBanner(banner.id, updates);

  await recordAudit({
    req,
    action: AuditLog.ACTION.CAMPAIGN_BANNER_UPDATED,
    entityType: AuditLog.ENTITY_TYPE.CAMPAIGN,
    entityId: campaign.id,
    branchId: campaign.branch_id,
    metadata: { banner_id: banner.id, fields: Object.keys(updates) },
  });

  res.json(updated);
}

// DELETE /api/campaigns/banners/:bannerId (campaign.manage)
async function removeBanner(req, res) {
  const banner = await campaignRepository.findBannerById(req.params.bannerId);
  if (!banner) return res.status(404).json({ message: 'Banner not found' });

  const campaign = await campaignRepository.findById(banner.campaign_id);
  if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
  if (!(await canManage(req, campaign))) {
    return forbidden(res, isGlobal(campaign) ? 'Only a super admin can manage a Global Campaign' : 'Forbidden');
  }

  await campaignRepository.removeBanner(banner.id);

  await recordAudit({
    req,
    action: AuditLog.ACTION.CAMPAIGN_BANNER_DELETED,
    entityType: AuditLog.ENTITY_TYPE.CAMPAIGN,
    entityId: campaign.id,
    branchId: campaign.branch_id,
    metadata: { banner_id: banner.id, title: banner.title },
  });

  res.json({ message: 'Deleted' });
}

// Shared validation for the banner fields that are optional on both create and update.
function validateBannerOptionals(body) {
  const out = {};
  if (body.placement !== undefined) {
    if (!BANNER_PLACEMENTS.includes(body.placement)) {
      return { error: `placement must be one of ${BANNER_PLACEMENTS.join(', ')}`, code: 'INVALID_PLACEMENT' };
    }
    out.placement = body.placement;
  }
  if (body.status !== undefined) {
    if (!BANNER_STATUSES.includes(body.status)) {
      return { error: `status must be one of ${BANNER_STATUSES.join(', ')}`, code: 'INVALID_STATUS' };
    }
    out.status = body.status;
  }
  if (body.sort_order !== undefined) {
    if (!Number.isFinite(Number(body.sort_order))) {
      return { error: 'sort_order must be a number', code: 'INVALID_SORT_ORDER' };
    }
    out.sort_order = Number(body.sort_order);
  }
  return out;
}

// ---- Public feed ------------------------------------------------------------

// GET /api/campaigns/public?branchId=&placement= — unauthenticated. This is the only endpoint
// customer surfaces read, and it goes through the campaign service, so an expired, draft,
// paused or archived campaign is structurally unable to appear here.
async function publicFeed(req, res) {
  const branchId = parseBranchId(req.query.branchId);
  if (branchId === undefined) return res.status(400).json({ message: 'branchId must be a number' });

  const placement =
    req.query.placement && BANNER_PLACEMENTS.includes(req.query.placement) ? req.query.placement : null;

  const data = await campaignService.resolveVisibleCampaigns({ branchId, placement });
  res.json({ data });
}

// GET /api/campaigns/meta (campaign.read) — the enums the admin form renders from, so the
// frontend never hardcodes a status/target/placement list that could drift from the model.
async function meta(_req, res) {
  res.json({
    statuses: STATUSES,
    targetTypes: TARGET_TYPES,
    placements: BANNER_PLACEMENTS,
    states: Object.values(STATE),
  });
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  notify,
  listBanners,
  createBanner,
  updateBanner,
  removeBanner,
  publicFeed,
  meta,
  // exported for the route-level guards and tests
  evaluate: evaluateCampaign,
};
