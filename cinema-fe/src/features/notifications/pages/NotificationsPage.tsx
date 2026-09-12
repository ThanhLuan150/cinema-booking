import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Pagination } from '@/components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useNotifications';
import { NotificationsHeader } from '../components/NotificationsHeader';
import { NotificationList } from '../components/NotificationList';

function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useNotifications(page, DEFAULT_PAGE_SIZE, unreadOnly ? { unread: true } : {});
  const { data: unread = 0 } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = data?.data ?? [];

  return (
    <AccountLayout title={t('feed.title')}>
      <NotificationsHeader
        unread={unread}
        unreadOnly={unreadOnly}
        onToggleUnreadOnly={() => {
          setUnreadOnly((v) => !v);
          setPage(1);
        }}
        onMarkAllRead={() => markAll.mutate()}
        markAllPending={markAll.isPending}
      />

      <NotificationList isLoading={isLoading} items={items} onMarkRead={(id) => markRead.mutate(id)} />

      {data && data.totalPages > 1 && (
        <div className="mt-6">
          <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        </div>
      )}
    </AccountLayout>
  );
}

export default NotificationsPage;
