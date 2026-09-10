import { describe, expect, it } from 'vitest';
import { evaluateCampaign, isCampaignVisible, canDispatchNotification } from './campaignWindow';

const NOW = new Date('2026-06-15T12:00:00Z');
const open = { status: 'ACTIVE' as const, start_at: '2026-06-01T00:00:00Z', end_at: '2026-06-30T00:00:00Z' };

describe('campaignWindow (frontend mirror of the backend rule)', () => {
  it('RUNNING + visible inside the window when ACTIVE', () => {
    expect(evaluateCampaign(open, NOW)).toEqual({ state: 'RUNNING', visible: true });
  });

  it('EXPIRED + hidden once the window closes, whatever the stored status', () => {
    expect(evaluateCampaign({ ...open, end_at: '2026-06-10T00:00:00Z' }, NOW)).toEqual({
      state: 'EXPIRED',
      visible: false,
    });
  });

  it('expiry beats PAUSED', () => {
    expect(evaluateCampaign({ ...open, status: 'PAUSED', end_at: '2026-06-10T00:00:00Z' }, NOW).state).toBe('EXPIRED');
  });

  it('SCHEDULED before the window, PAUSED/ DRAFT / ARCHIVED never visible', () => {
    expect(evaluateCampaign({ ...open, start_at: '2026-07-01T00:00:00Z' }, NOW).state).toBe('SCHEDULED');
    expect(isCampaignVisible({ ...open, status: 'PAUSED' }, NOW)).toBe(false);
    expect(isCampaignVisible({ ...open, status: 'DRAFT' }, NOW)).toBe(false);
    expect(isCampaignVisible({ ...open, status: 'ARCHIVED' }, NOW)).toBe(false);
  });

  it('an unparseable window resolves to DRAFT, never visible', () => {
    expect(evaluateCampaign({ ...open, end_at: 'nonsense' }, NOW)).toEqual({ state: 'DRAFT', visible: false });
  });

  it('canDispatchNotification tracks visibility', () => {
    expect(canDispatchNotification(open, NOW)).toBe(true);
    expect(canDispatchNotification({ ...open, status: 'PAUSED' }, NOW)).toBe(false);
  });
});
