import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/redux', () => ({
  useAppSelector: (sel: (s: unknown) => unknown) => sel({ auth: { accessToken: 'tok' } }),
}));

const getNotifications = vi.fn();
const getUnreadCount = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
vi.mock('../api/notifications.api', () => ({
  getNotifications: (...a: unknown[]) => getNotifications(...a),
  getUnreadCount: (...a: unknown[]) => getUnreadCount(...a),
  markNotificationRead: (...a: unknown[]) => markNotificationRead(...a),
  markAllNotificationsRead: (...a: unknown[]) => markAllNotificationsRead(...a),
}));

import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from './useNotifications';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const emptyPage = { data: [], total: 0, page: 1, limit: 10, totalPages: 1 };

describe('notification hooks', () => {
  beforeEach(() => {
    getNotifications.mockReset().mockResolvedValue(emptyPage);
    getUnreadCount.mockReset().mockResolvedValue(2);
    markNotificationRead.mockReset().mockResolvedValue({});
    markAllNotificationsRead.mockReset().mockResolvedValue({ updated: 2 });
  });

  it('useNotifications forwards page, limit and filters', async () => {
    const { result } = renderHook(() => useNotifications(3, 10, { unread: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getNotifications).toHaveBeenCalledWith({ page: 3, limit: 10, unread: true });
  });

  it('useUnreadCount returns the number', async () => {
    const { result } = renderHook(() => useUnreadCount(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(2);
  });

  it('useMarkNotificationRead calls the api', async () => {
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper });
    await result.current.mutateAsync(9);
    expect(markNotificationRead).toHaveBeenCalledWith(9);
  });

  it('useMarkAllNotificationsRead calls the api', async () => {
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper });
    await result.current.mutateAsync();
    expect(markAllNotificationsRead).toHaveBeenCalled();
  });
});
