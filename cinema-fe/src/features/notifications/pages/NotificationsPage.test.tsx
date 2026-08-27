import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string; count?: number }) => opts?.defaultValue ?? key }),
}));

vi.mock('@/components/layout/AccountLayout', () => ({
  AccountLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const useNotifications = vi.fn();
const useUnreadCount = vi.fn();
const markReadMutate = vi.fn();
const markAllMutate = vi.fn();
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: (...a: unknown[]) => useNotifications(...a),
  useUnreadCount: (...a: unknown[]) => useUnreadCount(...a),
  useMarkNotificationRead: () => ({ mutate: markReadMutate, isPending: false }),
  useMarkAllNotificationsRead: () => ({ mutate: markAllMutate, isPending: false }),
}));

import NotificationsPage from './NotificationsPage';

const unread = {
  id: 1, account_id: 7, type: 'BOOKING_CREATED' as const, title: 'Booking created', body: 'b',
  data: { movie: 'Dune', bookingCode: 'BK-1' }, channels: ['IN_APP' as const], status: 'SENT' as const,
  read_at: null, sent_at: null, createdAt: '2026-08-27T10:00:00.000Z', updatedAt: '2026-08-27T10:00:00.000Z',
};

describe('NotificationsPage', () => {
  beforeEach(() => {
    useNotifications.mockReset().mockReturnValue({
      data: { data: [unread], total: 1, page: 1, limit: 10, totalPages: 1 },
      isLoading: false,
    });
    useUnreadCount.mockReset().mockReturnValue({ data: 1 });
    markReadMutate.mockReset();
    markAllMutate.mockReset();
  });

  it('lists notifications with their localised title', () => {
    render(<NotificationsPage />);
    expect(screen.getByText('Booking created')).toBeInTheDocument();
  });

  it('renders the empty state when there is nothing', () => {
    useNotifications.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 10, totalPages: 1 }, isLoading: false });
    render(<NotificationsPage />);
    expect(screen.getByText('feed.empty')).toBeInTheDocument();
  });

  it('marks a single notification read', () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByText('feed.markRead'));
    expect(markReadMutate).toHaveBeenCalledWith(1);
  });

  it('toggles the unread-only filter and refetches from page 1', () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByText('feed.unreadOnly'));
    // last call should carry the unread filter
    expect(useNotifications).toHaveBeenLastCalledWith(1, 10, { unread: true });
  });

  it('marks all read', () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByText('feed.markAllRead'));
    expect(markAllMutate).toHaveBeenCalled();
  });
});
