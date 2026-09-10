const Campaign = require('../models/Campaign');
const Notification = require('../models/Notification');
const campaignRepository = require('../repositories/campaign.repository');
const movieRepository = require('../repositories/movie.repository');
const promotionRepository = require('../repositories/promotion.repository');
const branchRepository = require('../repositories/branch.repository');
const notificationService = require('./notification.service');
const { evaluateCampaign, canDispatchNotification, visibleQuery } = require('../utils/campaignWindow');

async function loadLinks(campaign) {
  const [movies, promotions] = await Promise.all([
    Promise.all((campaign.movie_ids || []).map((id) => movieRepository.findById(id))),
    Promise.all((campaign.promotion_ids || []).map((id) => promotionRepository.findById(id))),
  ]);

  return {
    movies: movies
      .filter(Boolean)
      .map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, banner: m.banner, premiere_date: m.premiere_date })),
    // Only the display-safe face of a promotion — never its usage counters or internal limits.
    promotions: promotions
      .filter(Boolean)
      .map((p) => ({ id: p.id, code: p.code, name: p.name, description: p.description, end_at: p.end_at })),
  };
}

function publicShape(campaign, banners, links) {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    start_at: campaign.start_at,
    end_at: campaign.end_at,
    target_type: campaign.target_type,
    branch_id: campaign.branch_id,
    banners: banners.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      image_url: b.image_url,
      link_url: b.link_url,
      placement: b.placement,
      sort_order: b.sort_order,
    })),
    movies: links.movies,
    promotions: links.promotions,
  };
}

/**
 * The customer-facing campaign feed: every campaign on air right now for this audience, with
 * its ACTIVE banners and its linked movies/promotions attached.
 *
 * A Global Campaign (branch_id null) always applies; a branch campaign only when `branchId`
 * matches. `placement` narrows to banners meant for one surface, and a campaign with no banner
 * for that surface drops out entirely — a placement query is a request for artwork.
 */
async function resolveVisibleCampaigns({ branchId = null, placement = null, now = new Date(), limit = 20 } = {}) {
  const candidates = await campaignRepository.findVisibleCandidates(visibleQuery(now), {
    branchId,
    limit: limit * 2,
  });

  // Re-check every row against the rule itself. The Mongo filter above is only a pre-filter;
  // this is what actually decides, so the two can never drift apart.
  const live = candidates.filter((c) => evaluateCampaign(c, now).visible).slice(0, limit);
  if (live.length === 0) return [];

  const allBanners = await campaignRepository.findBannersByCampaignIds(
    live.map((c) => c.id),
    { activeOnly: true },
  );
  const bannersByCampaign = new Map();
  for (const banner of allBanners) {
    if (placement && banner.placement !== placement) continue;
    const list = bannersByCampaign.get(banner.campaign_id) || [];
    list.push(banner);
    bannersByCampaign.set(banner.campaign_id, list);
  }

  const out = [];
  for (const campaign of live) {
    const banners = bannersByCampaign.get(campaign.id) || [];
    if (placement && banners.length === 0) continue;
    out.push(publicShape(campaign, banners, await loadLinks(campaign)));
  }
  return out;
}

// ---- Notification blast -----------------------------------------------------

const DISPATCH_ERROR = {
  NOTIFICATION_DISABLED: 'CAMPAIGN_NOTIFICATION_DISABLED',
  NOTIFICATION_EMPTY: 'CAMPAIGN_NOTIFICATION_EMPTY',
  NOT_RUNNING: 'CAMPAIGN_NOT_RUNNING',
};

// The per-recipient dedupe key. Deliberately campaign+account only (no timestamp, no attempt
// counter): the notification table's unique index on `dedupe_key` then makes a repeat dispatch
// a no-op for everyone already reached, which is the ticket's "không gửi Notification duplicate"
// guarantee — enforced by the database, not by a check a caller could skip.
function dedupeKeyFor(campaignId, accountId) {
  return `CAMPAIGN:${campaignId}:${accountId}`;
}

/**
 * Send a campaign's announcement to its target audience.
 *
 * Returns `{ error, code }` when the campaign is not in a state that may reach customers, else
 * `{ audience, sent, skipped }` — `skipped` being the recipients who already held this
 * campaign's notification and were therefore not notified again.
 */
async function dispatchCampaignNotification(campaign, { now = new Date() } = {}) {
  if (!campaign.notification_enabled) {
    return { error: 'This campaign has no notification enabled', code: DISPATCH_ERROR.NOTIFICATION_DISABLED };
  }
  if (!String(campaign.notification_title || '').trim()) {
    return {
      error: 'The campaign notification needs a title before it can be sent',
      code: DISPATCH_ERROR.NOTIFICATION_EMPTY,
    };
  }
  // A draft / scheduled / paused / expired campaign must never reach a customer's inbox — the
  // same rule that keeps it off the site keeps it out of notifications.
  if (!canDispatchNotification(campaign, now)) {
    return {
      error: 'Only a campaign that is currently running can send its notification',
      code: DISPATCH_ERROR.NOT_RUNNING,
    };
  }

  const accountIds = await campaignRepository.findAudienceAccountIds({
    targetType: campaign.target_type,
    branchId: campaign.branch_id,
  });

  const branch = campaign.branch_id !== null ? await branchRepository.findById(campaign.branch_id) : null;
  const data = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignTitle: campaign.notification_title,
    campaignBody: campaign.notification_body,
    ref: `campaign-${campaign.id}`,
  };
  if (branch) data.branch = branch.name;

  let sent = 0;
  for (const accountId of accountIds) {
    // `notify` never throws and returns null for a duplicate, so one bad recipient can neither
    // abort the blast nor double-notify anybody.
    const created = await notificationService.notify({
      event: Notification.EVENT.CAMPAIGN_ANNOUNCEMENT,
      accountId,
      data,
      channels: [Notification.CHANNEL.IN_APP],
      dedupeKey: dedupeKeyFor(campaign.id, accountId),
    });
    if (created) sent += 1;
  }

  if (sent > 0) {
    await campaignRepository.recordNotificationDispatch(campaign.id, { sentCount: sent, at: now });
  }

  return { audience: accountIds.length, sent, skipped: accountIds.length - sent };
}

// Decorates an admin-facing campaign row with its derived state, so the management UI can show
// "Expired" / "Scheduled" without duplicating the rule.
function withDerivedState(campaign, now = new Date()) {
  const { state, visible } = evaluateCampaign(campaign, now);
  const json = typeof campaign.toJSON === 'function' ? campaign.toJSON() : { ...campaign };
  return { ...json, display_state: state, is_visible: visible };
}

module.exports = {
  resolveVisibleCampaigns,
  dispatchCampaignNotification,
  withDerivedState,
  dedupeKeyFor,
  loadLinks,
  DISPATCH_ERROR,
  STATUS: Campaign.STATUS,
  TARGET_TYPE: Campaign.TARGET_TYPE,
};
