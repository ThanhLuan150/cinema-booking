const webhookService = require('../services/webhook.service');

jest.mock('../services/webhook.service', () => ({
  retryFailed: jest.fn().mockResolvedValue([]),
}));

describe('startWebhookRetrySweep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('periodically runs the webhook retry sweep', async () => {
    const { startWebhookRetrySweep, SWEEP_INTERVAL_MS } = require('./webhookRetry.job');
    const timer = startWebhookRetrySweep();

    expect(webhookService.retryFailed).not.toHaveBeenCalled();
    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(webhookService.retryFailed).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(SWEEP_INTERVAL_MS);
    await Promise.resolve();
    expect(webhookService.retryFailed).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });

  it('does not keep the process alive on its own (timer is unref-ed)', () => {
    const { startWebhookRetrySweep } = require('./webhookRetry.job');
    const timer = startWebhookRetrySweep();
    expect(typeof timer.unref).toBe('function');
    clearInterval(timer);
  });
});
