import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAppSelector } from '@/hooks/redux';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationFilters,
} from '../api/notifications.api';

export const notificationsQueryKey = ['notifications'] as const;
export const unreadCountQueryKey = ['notifications', 'unread-count'] as const;

// Only poll / fetch when the visitor is signed in — the endpoints 401 otherwise.
function useIsLoggedIn() {
  return useAppSelector((state) => !!state.auth.accessToken);
}

export function useNotifications(page: number, limit: number, filters: NotificationFilters = {}) {
  const enabled = useIsLoggedIn();
  return useQuery({
    queryKey: [...notificationsQueryKey, page, limit, filters],
    queryFn: () => getNotifications({ page, limit, ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUnreadCount() {
  const enabled = useIsLoggedIn();
  return useQuery({
    queryKey: unreadCountQueryKey,
    queryFn: getUnreadCount,
    enabled,
    // A lightweight safety net in case a realtime push is missed.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsQueryKey });
      qc.invalidateQueries({ queryKey: unreadCountQueryKey });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationsQueryKey });
      qc.invalidateQueries({ queryKey: unreadCountQueryKey });
    },
  });
}
