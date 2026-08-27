import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/cn';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useNotifications';
import { presentNotification } from '../lib/notificationPresenter';

const toneClass = {
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  neutral: 'text-accent',
} as const;

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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-txt">{t('feed.title')}</h1>
          <p className="mt-0.5 text-sm text-txt/60">
            {unread > 0 ? t('feed.unreadCount', { count: unread }) : t('feed.allRead')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setUnreadOnly((v) => !v);
              setPage(1);
            }}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              unreadOnly
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border-strong text-txt/70 hover:text-txt',
            )}
          >
            {t('feed.unreadOnly')}
          </button>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || unread === 0}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-txt/70 transition-colors hover:text-txt disabled:opacity-40"
          >
            {t('feed.markAllRead')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="fa-regular fa-bell" title={t('feed.empty')} description={t('feed.emptyHint')} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((n) => {
            const view = presentNotification(n, t);
            return (
              <li key={n.id} className={cn('flex gap-4 px-5 py-4', !n.read_at && 'bg-accent/5')}>
                <i
                  className={cn(view.icon, 'mt-1 w-5 text-center text-lg', toneClass[view.tone])}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-txt">
                      {view.title}
                      {!n.read_at && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-accent align-middle" />}
                    </p>
                    <time className="shrink-0 text-xs text-txt/40">{new Date(n.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-sm text-txt/70">{view.description}</p>
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n.id)}
                      className="mt-2 text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      {t('feed.markRead')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-6">
          <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        </div>
      )}
    </AccountLayout>
  );
}

export default NotificationsPage;
