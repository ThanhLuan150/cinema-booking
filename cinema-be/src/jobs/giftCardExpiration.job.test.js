const giftCardService = require('../services/giftCard.service');

jest.mock('../services/giftCard.service', () => ({
  expireGiftCards: jest.fn().mockResolvedValue(0),
}));

describe('startGiftCardExpirationSweep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('periodically calls expireGiftCards to sweep lapsed gift cards', async () => {
    const { startGiftCardExpirationSweep } = require('./giftCardExpiration.job');
    const timer = startGiftCardExpirationSweep();

    expect(giftCardService.expireGiftCards).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60 * 60 * 1000);
    await Promise.resolve();
    expect(giftCardService.expireGiftCards).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60 * 60 * 1000);
    await Promise.resolve();
    expect(giftCardService.expireGiftCards).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });

  it('does not keep the process alive on its own (timer is unref-ed)', () => {
    const { startGiftCardExpirationSweep } = require('./giftCardExpiration.job');
    const timer = startGiftCardExpirationSweep();
    expect(typeof timer.unref).toBe('function');
    clearInterval(timer);
  });
});
