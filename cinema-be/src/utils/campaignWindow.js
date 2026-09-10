const STATE = {
  DRAFT: 'DRAFT', // not published yet
  SCHEDULED: 'SCHEDULED', // published, window has not opened
  RUNNING: 'RUNNING', // on air right now  -> visible
  PAUSED: 'PAUSED', // deliberately pulled while the window is still open
  EXPIRED: 'EXPIRED', // window has closed
  ARCHIVED: 'ARCHIVED', // retired by an admin
};

function toTime(value) {
  if (value === null || value === undefined) return NaN;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? NaN : t;
}

/**
 * Derive a campaign's display state at a moment in time.
 *
 * Precedence matters: ARCHIVED and DRAFT are absolute (they beat the window), then expiry wins
 * over PAUSED — a paused campaign whose window has closed reads as EXPIRED, because that is the
 * terminal fact about it and un-pausing would not bring it back.
 *
 * A row with an unparseable window is treated as DRAFT rather than shown: an unknown window must
 * never resolve to "visible".
 *
 * @param {{status?:string,start_at?:Date|string,end_at?:Date|string}} campaign
 * @param {Date} [now]
 * @returns {{ state: string, visible: boolean }}
 */
function evaluateCampaign(campaign, now = new Date()) {
  if (!campaign) return { state: STATE.DRAFT, visible: false };

  const status = campaign.status;
  if (status === 'ARCHIVED') return { state: STATE.ARCHIVED, visible: false };
  if (status === 'DRAFT') return { state: STATE.DRAFT, visible: false };

  const start = toTime(campaign.start_at);
  const end = toTime(campaign.end_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return { state: STATE.DRAFT, visible: false };

  const at = toTime(now);
  if (at > end) return { state: STATE.EXPIRED, visible: false };
  if (status === 'PAUSED') return { state: STATE.PAUSED, visible: false };
  if (at < start) return { state: STATE.SCHEDULED, visible: false };

  return { state: STATE.RUNNING, visible: true };
}

function isCampaignVisible(campaign, now = new Date()) {
  return evaluateCampaign(campaign, now).visible;
}

// A campaign may only blast its notification while it is on air — a draft, a scheduled, a
// paused or an expired campaign must not reach customers' inboxes.
function canDispatchNotification(campaign, now = new Date()) {
  return isCampaignVisible(campaign, now);
}

/**
 * Mongo filter fragment matching the rows that *could* be visible at `now`. It is a
 * pre-filter for the database, not the rule itself — callers still run every row through
 * `evaluateCampaign` so the two can never drift.
 */
function visibleQuery(now = new Date()) {
  return { status: 'ACTIVE', start_at: { $lte: now }, end_at: { $gte: now } };
}

module.exports = { STATE, evaluateCampaign, isCampaignVisible, canDispatchNotification, visibleQuery };
