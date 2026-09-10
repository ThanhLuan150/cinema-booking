import type { Campaign, CampaignDisplayState } from '@/types/entities';

export const CAMPAIGN_STATE: Record<CampaignDisplayState, CampaignDisplayState> = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
};

function toTime(value: string | Date | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? NaN : t;
}

type WindowInput = Pick<Campaign, 'status' | 'start_at' | 'end_at'> | null | undefined;

/**
 * Derive a campaign's display state at a moment in time. ARCHIVED and DRAFT are absolute; then
 * expiry wins over PAUSED (a paused campaign whose window has closed reads as EXPIRED); an
 * unparseable window resolves to DRAFT so it is never treated as visible.
 */
export function evaluateCampaign(
  campaign: WindowInput,
  now: Date = new Date(),
): { state: CampaignDisplayState; visible: boolean } {
  if (!campaign) return { state: 'DRAFT', visible: false };

  if (campaign.status === 'ARCHIVED') return { state: 'ARCHIVED', visible: false };
  if (campaign.status === 'DRAFT') return { state: 'DRAFT', visible: false };

  const start = toTime(campaign.start_at);
  const end = toTime(campaign.end_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return { state: 'DRAFT', visible: false };

  const at = toTime(now);
  if (at > end) return { state: 'EXPIRED', visible: false };
  if (campaign.status === 'PAUSED') return { state: 'PAUSED', visible: false };
  if (at < start) return { state: 'SCHEDULED', visible: false };

  return { state: 'RUNNING', visible: true };
}

export function isCampaignVisible(campaign: WindowInput, now: Date = new Date()): boolean {
  return evaluateCampaign(campaign, now).visible;
}

// The blast may only go out while the campaign is on air.
export function canDispatchNotification(campaign: WindowInput, now: Date = new Date()): boolean {
  return isCampaignVisible(campaign, now);
}
