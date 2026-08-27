import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
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

import { NotificationBell } from './NotificationBell';

const item = {
  id: 1,
  account_id: 7,
  type: 'PAYMENT_SUCCESS' as const,
  title: 'Payment successful',
  body: 'ok',
  data: { movie: 'Dune', bookingCode: 'BK-1' },
  channels: ['IN_APP' as const],
  status: 'SENT' as const,
  read_at: null,
  sent_at: null,
  createdAt: '2026-08-27T10:00:00.000Z',
  updatedAt: '2026-08-27T10:00:00.000Z',
};

function renderBell() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NotificationBell />
    </MemoryRouter>,
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    useNotifications.mockReset().mockReturnValue({ data: { data: [item], total: 1, totalPages: 1 } });
    useUnreadCount.mockReset().mockReturnValue({ data: 3 });
    markReadMutate.mockReset();
    markAllMutate.mockReset();
  });

  it('shows the unread badge with the count', () => {
    renderBell();
    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('3');
  });

  it('caps the badge at 99+', () => {
    useUnreadCount.mockReturnValue({ data: 150 });
    renderBell();
    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('99+');
  });

  it('opens the dropdown and lists notifications', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'feed.bellLabel' }));
    expect(screen.getByText('Payment successful')).toBeInTheDocument();
  });

  it('marks an unread item read when clicked', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'feed.bellLabel' }));
    fireEvent.click(screen.getByText('Payment successful'));
    expect(markReadMutate).toHaveBeenCalledWith(1);
  });

  it('marks all read from the dropdown header', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'feed.bellLabel' }));
    fireEvent.click(screen.getByText('feed.markAllRead'));
    expect(markAllMutate).toHaveBeenCalled();
  });

  it('renders no badge when there are no unread notifications', () => {
    useUnreadCount.mockReturnValue({ data: 0 });
    renderBell();
    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
  });
});
