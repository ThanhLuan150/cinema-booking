import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: { get: (...args: unknown[]) => getMock(...args), post: (...args: unknown[]) => postMock(...args) },
}));

import * as schedulesApi from './schedules.api';

describe('admin schedules.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getSchedules merges filters and pagination into params', async () => {
    await schedulesApi.getSchedules({ branchId: 1 }, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/schedule', { params: { branchId: 1, page: 1 } });
  });

  it('createSchedule posts to /schedule', async () => {
    const payload = { movie_id: 1 };
    await schedulesApi.createSchedule(payload);
    expect(postMock).toHaveBeenCalledWith('/schedule', payload);
  });

  it('createTicket posts to /ticket', async () => {
    await schedulesApi.createTicket({ schedule_id: 5 });
    expect(postMock).toHaveBeenCalledWith('/ticket', { schedule_id: 5 });
  });
});
