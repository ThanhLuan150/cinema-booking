import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import * as api from './waitlist.api';

describe('waitlist.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: { data: [] } });
    postMock.mockResolvedValue({ data: { id: 31 } });
  });

  it('getMyWaitlist sends the status filter as a comma list', async () => {
    await api.getMyWaitlist({ page: 2, limit: 10, status: ['WAITING', 'NOTIFIED'] });
    expect(getMock).toHaveBeenCalledWith('/waitlist', { params: { page: 2, limit: 10, status: 'WAITING,NOTIFIED' } });
  });

  it('getMyWaitlist leaves the status out when there is no filter', async () => {
    await api.getMyWaitlist({ page: 1 });
    expect(getMock).toHaveBeenCalledWith('/waitlist', { params: { page: 1, status: undefined } });
  });

  it('getShowtimeWaitlist reads one showtime', async () => {
    getMock.mockResolvedValue({ data: { schedule_id: 7 } });
    expect(await api.getShowtimeWaitlist(7)).toEqual({ schedule_id: 7 });
    expect(getMock).toHaveBeenCalledWith('/waitlist/showtimes/7');
  });

  it('joinWaitlist posts only the showtime and the seat count', async () => {
    expect(await api.joinWaitlist({ schedule_id: 7, seat_count: 2 })).toEqual({ id: 31 });
    expect(postMock).toHaveBeenCalledWith('/waitlist', { schedule_id: 7, seat_count: 2 });
  });

  it('cancelWaitlistEntry posts to the entry', async () => {
    await api.cancelWaitlistEntry(31);
    expect(postMock).toHaveBeenCalledWith('/waitlist/31/cancel');
  });
});
