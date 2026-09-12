import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/cn';
import type { Notification } from '@/types/entities';
import { presentNotification } from '../lib/notificationPresenter';
import { TONE_CLASS } from '../constants';

interface NotificationListProps {
  isLoading: boolean;
  items: Notification[];
  onMarkRead: (id: number) => void;
}

export function NotificationList({ isLoading, items, onMarkRead }: NotificationListProps) {
  const { t } = useTranslation('notifications');

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState icon="fa-regular fa-bell" title={t('feed.empty')} description={t('feed.emptyHint')} />;
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((n) => {
        const view = presentNotification(n, t);
        return (
          <li key={n.id} className={cn('flex gap-4 px-5 py-4', !n.read_at && 'bg-accent/5')}>
            <i
              className={cn(view.icon, 'mt-1 w-5 text-center text-lg', TONE_CLASS[view.tone])}
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
                  onClick={() => onMarkRead(n.id)}
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
  );
}
