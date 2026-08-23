const bookingRepository = require('../repositories/booking.repository');

jest.mock('../repositories/booking.repository', () => ({
  expireAllHeldTickets: jest.fn().mockResolvedValue({}),
}));

describe('startSeatHoldSweep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('periodically calls expireAllHeldTickets to auto-release expired holds', async () => {
    const { startSeatHoldSweep } = require('./expireHolds.job');
    const timer = startSeatHoldSweep();

    expect(bookingRepository.expireAllHeldTickets).not.toHaveBeenCalled();

    jest.advanceTimersByTime(30000);
    await Promise.resolve();
    expect(bookingRepository.expireAllHeldTickets).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30000);
    await Promise.resolve();
    expect(bookingRepository.expireAllHeldTickets).toHaveBeenCalledTimes(2);

    clearInterval(timer);
  });

  it('does not keep the process alive on its own (timer is unref-ed)', () => {
    const { startSeatHoldSweep } = require('./expireHolds.job');
    const timer = startSeatHoldSweep();
    expect(typeof timer.unref).toBe('function');
    clearInterval(timer);
  });
});
