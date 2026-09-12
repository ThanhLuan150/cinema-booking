import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface NotificationsHeaderProps {
  unread: number;
  unreadOnly: boolean;
  onToggleUnreadOnly: () => void;
  onMarkAllRead: () => void;
  markAllPending: boolean;
}

export function NotificationsHeader({
  unread,
  unreadOnly,
  onToggleUnreadOnly,
  onMarkAllRead,
  markAllPending,
}: NotificationsHeaderProps) {
  const { t } = useTranslation('notifications');

  return (
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
          onClick={onToggleUnreadOnly}
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
          onClick={onMarkAllRead}
          disabled={markAllPending || unread === 0}
          className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-txt/70 transition-colors hover:text-txt disabled:opacity-40"
        >
          {t('feed.markAllRead')}
        </button>
      </div>
    </div>
  );
}
