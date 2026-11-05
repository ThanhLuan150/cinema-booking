const subscriptionService = require('../services/subscription.service');

jest.mock('../services/subscription.service', () => ({
  expireSubscriptions: jest.fn().mockResolvedValue({ expired: 0, lapsed: 0 }),
}));

describe('startSubscriptionSweep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('periodically expires ended subscriptions and lapsed purchases', async () => {
    const { startSubscriptionSweep, SWEEP_INTERVAL_MS } = require('./subscriptionSweep.job');
    const timer = startSubscriptionSweep();

    expect(subscriptionService.expireSubscriptions).not.toHaveBeenCalled();
    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(subscriptionService.expireSubscriptions).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(subscriptionService.expireSubscriptions).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });

  it('logs a failed sweep instead of crashing', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    subscriptionService.expireSubscriptions.mockRejectedValueOnce(new Error('db down'));
    const { startSubscriptionSweep, SWEEP_INTERVAL_MS } = require('./subscriptionSweep.job');
    const timer = startSubscriptionSweep();

    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(spy).toHaveBeenCalledWith('[subscriptionSweep] failed to expire subscriptions', expect.any(Error));

    clearInterval(timer);
    spy.mockRestore();
  });

  it('does not keep the process alive on its own (timer is unref-ed)', () => {
    const { startSubscriptionSweep } = require('./subscriptionSweep.job');
    const timer = startSubscriptionSweep();
    expect(typeof timer.unref).toBe('function');
    clearInterval(timer);
  });
});
