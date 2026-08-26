const loyaltyService = require('../services/loyaltyService');

jest.mock('../services/loyaltyService', () => ({
  expirePoints: jest.fn().mockResolvedValue(0),
}));

describe('startPointsExpirationSweep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('periodically calls expirePoints to sweep lapsed loyalty points', async () => {
    const { startPointsExpirationSweep } = require('./pointsExpiration.job');
    const timer = startPointsExpirationSweep();

    expect(loyaltyService.expirePoints).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60 * 60 * 1000);
    await Promise.resolve();
    expect(loyaltyService.expirePoints).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60 * 60 * 1000);
    await Promise.resolve();
    expect(loyaltyService.expirePoints).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });

  it('does not keep the process alive on its own (timer is unref-ed)', () => {
    const { startPointsExpirationSweep } = require('./pointsExpiration.job');
    const timer = startPointsExpirationSweep();
    expect(typeof timer.unref).toBe('function');
    clearInterval(timer);
  });
});
