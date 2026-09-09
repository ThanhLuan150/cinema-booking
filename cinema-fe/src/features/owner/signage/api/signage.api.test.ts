import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import * as signageApi from './signage.api';

describe('signage.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
    postMock.mockResolvedValue({ data: {} });
  });

  it('getScreens gets /signage/screens with branchId and params', async () => {
    await signageApi.getScreens(1, { page: 1, status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith('/signage/screens', { params: { branchId: 1, page: 1, status: 'ACTIVE' } });
  });

  it('createScreen posts /signage/screens and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { id: 7 } });
    const res = await signageApi.createScreen({ branch_id: 1, name: 'Lobby' });
    expect(postMock).toHaveBeenCalledWith('/signage/screens', { branch_id: 1, name: 'Lobby' });
    expect(res.id).toBe(7);
  });

  it('getScreenPlayback gets /signage/screens/:id/playback', async () => {
    await signageApi.getScreenPlayback(3);
    expect(getMock).toHaveBeenCalledWith('/signage/screens/3/playback', { params: undefined });
  });

  it('getContents gets /signage/contents with type filter', async () => {
    await signageApi.getContents(2, { type: 'SHOWTIME', status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith('/signage/contents', { params: { branchId: 2, type: 'SHOWTIME', status: 'ACTIVE' } });
  });

  it('createContent / updateContent / deleteContent target /signage/contents', async () => {
    postMock.mockResolvedValue({ data: { id: 1 } });
    await signageApi.createContent({ branch_id: 1, type: 'ANNOUNCEMENT', title: 'Hi' });
    expect(postMock).toHaveBeenCalledWith('/signage/contents', { branch_id: 1, type: 'ANNOUNCEMENT', title: 'Hi' });
    await signageApi.updateContent(4, { status: 'INACTIVE' });
    expect(putMock).toHaveBeenCalledWith('/signage/contents/4', { status: 'INACTIVE' });
    await signageApi.deleteContent(4);
    expect(deleteMock).toHaveBeenCalledWith('/signage/contents/4');
  });

  it('getSignageSchedules gets /signage/schedules scoped by screenId', async () => {
    await signageApi.getSignageSchedules(9, { page: 1 });
    expect(getMock).toHaveBeenCalledWith('/signage/schedules', { params: { screenId: 9, page: 1 } });
  });

  it('createSignageSchedule posts /signage/schedules', async () => {
    postMock.mockResolvedValue({ data: { id: 1 } });
    await signageApi.createSignageSchedule({ screen_id: 1, content_id: 2, start_at: 'a', end_at: 'b' });
    expect(postMock).toHaveBeenCalledWith('/signage/schedules', { screen_id: 1, content_id: 2, start_at: 'a', end_at: 'b' });
  });
});
