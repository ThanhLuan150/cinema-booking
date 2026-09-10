const { evaluateCampaign, isCampaignVisible, canDispatchNotification, STATE } = require('./campaignWindow');

const NOW = new Date('2026-06-15T12:00:00Z');
const open = {
  status: 'ACTIVE',
  start_at: '2026-06-01T00:00:00Z',
  end_at: '2026-06-30T00:00:00Z',
};

describe('campaignWindow.evaluateCampaign', () => {
  it('is RUNNING and visible inside the window when ACTIVE', () => {
    expect(evaluateCampaign(open, NOW)).toEqual({ state: STATE.RUNNING, visible: true });
  });

  it('is EXPIRED and hidden once the window has closed — regardless of stored status', () => {
    const past = { ...open, end_at: '2026-06-10T00:00:00Z' };
    expect(evaluateCampaign(past, NOW)).toEqual({ state: STATE.EXPIRED, visible: false });
  });

  it('treats an expired window as EXPIRED even when the campaign is PAUSED', () => {
    const pausedPast = { ...open, status: 'PAUSED', end_at: '2026-06-10T00:00:00Z' };
    expect(evaluateCampaign(pausedPast, NOW).state).toBe(STATE.EXPIRED);
  });

  it('is SCHEDULED and hidden before the window opens', () => {
    const future = { ...open, start_at: '2026-07-01T00:00:00Z' };
    expect(evaluateCampaign(future, NOW)).toEqual({ state: STATE.SCHEDULED, visible: false });
  });

  it('is PAUSED and hidden while the window is still open but status is PAUSED', () => {
    expect(evaluateCampaign({ ...open, status: 'PAUSED' }, NOW)).toEqual({ state: STATE.PAUSED, visible: false });
  });

  it('is never visible while DRAFT or ARCHIVED, even inside the window', () => {
    expect(evaluateCampaign({ ...open, status: 'DRAFT' }, NOW).visible).toBe(false);
    expect(evaluateCampaign({ ...open, status: 'ARCHIVED' }, NOW).visible).toBe(false);
  });

  it('falls back to DRAFT (never visible) for an unparseable window', () => {
    expect(evaluateCampaign({ ...open, end_at: 'not-a-date' }, NOW)).toEqual({ state: STATE.DRAFT, visible: false });
  });

  it('handles a null campaign', () => {
    expect(isCampaignVisible(null, NOW)).toBe(false);
  });
});

describe('campaignWindow.canDispatchNotification', () => {
  it('allows a dispatch only while the campaign is on air', () => {
    expect(canDispatchNotification(open, NOW)).toBe(true);
    expect(canDispatchNotification({ ...open, status: 'PAUSED' }, NOW)).toBe(false);
    expect(canDispatchNotification({ ...open, end_at: '2026-06-10T00:00:00Z' }, NOW)).toBe(false);
    expect(canDispatchNotification({ ...open, status: 'DRAFT' }, NOW)).toBe(false);
  });
});
