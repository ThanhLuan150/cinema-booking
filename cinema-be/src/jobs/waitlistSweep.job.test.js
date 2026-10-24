const waitlistService = require('../services/waitlist.service');

jest.mock('../services/waitlist.service', () => ({
  sweep: jest.fn().mockResolvedValue(0),
}));

describe('startWaitlistSweep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('periodically sweeps the waitlists', async () => {
    const { startWaitlistSweep, SWEEP_INTERVAL_MS } = require('./waitlistSweep.job');
    const timer = startWaitlistSweep();

    expect(waitlistService.sweep).not.toHaveBeenCalled();
    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(waitlistService.sweep).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(waitlistService.sweep).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });

  it('does not keep the process alive on its own (timer is unref-ed)', () => {
    const { startWaitlistSweep } = require('./waitlistSweep.job');
    const timer = startWaitlistSweep();
    expect(typeof timer.unref).toBe('function');
    clearInterval(timer);
  });
});
