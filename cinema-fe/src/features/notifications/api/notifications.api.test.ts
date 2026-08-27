import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const patchMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

import * as api from './notifications.api';

describe('notifications.api', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: {} });
    patchMock.mockReset().mockResolvedValue({ data: {} });
  });

  it('getNotifications hits /notifications with pagination + filters and unwraps data', async () => {
    getMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 10, totalPages: 1 } });
    await api.getNotifications({ page: 2, limit: 10, unread: true });
    expect(getMock).toHaveBeenCalledWith('/notifications', { params: { page: 2, limit: 10, unread: true } });
  });

  it('getUnreadCount unwraps { count }', async () => {
    getMock.mockResolvedValue({ data: { count: 4 } });
    expect(await api.getUnreadCount()).toBe(4);
    expect(getMock).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('markNotificationRead patches /notifications/:id/read', async () => {
    await api.markNotificationRead(7);
    expect(patchMock).toHaveBeenCalledWith('/notifications/7/read');
  });

  it('markAllNotificationsRead patches /notifications/read-all', async () => {
    patchMock.mockResolvedValue({ data: { updated: 3 } });
    expect(await api.markAllNotificationsRead()).toEqual({ updated: 3 });
    expect(patchMock).toHaveBeenCalledWith('/notifications/read-all');
  });
});
