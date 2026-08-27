const notificationService = require('../services/notification.service');

jest.mock('../services/notification.service', () => ({
  retryFailed: jest.fn().mockResolvedValue(0),
}));

describe('startNotificationRetrySweep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('periodically runs the notification retry sweep', async () => {
    const { startNotificationRetrySweep, SWEEP_INTERVAL_MS } = require('./notificationRetry.job');
    const timer = startNotificationRetrySweep();

    expect(notificationService.retryFailed).not.toHaveBeenCalled();
    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(notificationService.retryFailed).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(notificationService.retryFailed).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });

  it('does not keep the process alive on its own (timer is unref-ed)', () => {
    const { startNotificationRetrySweep } = require('./notificationRetry.job');
    const timer = startNotificationRetrySweep();
    expect(typeof timer.unref).toBe('function');
    clearInterval(timer);
  });
});
