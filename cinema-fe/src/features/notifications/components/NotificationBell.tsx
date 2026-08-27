import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/constants/routes';
import { useNotifications, useUnreadCount, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/useNotifications';
import { presentNotification } from '../lib/notificationPresenter';

const toneClass = {
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  neutral: 'text-accent',
} as const;

// Header bell for signed-in visitors: unread badge + a dropdown of the most recent items, each
// linking through to the full page. Realtime pushes (RealtimeBridge) keep the badge fresh.
export function NotificationBell() {
  const { t } = useTranslation('notifications');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: unread = 0 } = useUnreadCount();
  const { data: page } = useNotifications(1, 6, {});
  const items = page?.data ?? [];
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-txt/80 transition-colors hover:bg-white/10 hover:text-txt"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('feed.bellLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <i className="fa-regular fa-bell text-lg" aria-hidden="true" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-white"
            data-testid="notification-unread-badge"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-border-strong bg-surface-raised text-left shadow-raised"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-txt">{t('feed.title')}</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-50"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                {t('feed.markAllRead')}
              </button>
            )}
          </div>

          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-txt/60">{t('feed.empty')}</li>
            )}
            {items.map((n) => {
              const view = presentNotification(n, t);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5',
                      !n.read_at && 'bg-accent/5',
                    )}
                    onClick={() => {
                      if (!n.read_at) markRead.mutate(n.id);
                      setOpen(false);
                    }}
                  >
                    <i className={cn(view.icon, 'mt-0.5 w-4 text-center', toneClass[view.tone])} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-txt">{view.title}</span>
                        {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-txt/70">{view.description}</span>
                      <span className="mt-1 block text-[11px] text-txt/40">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Link
            to={ROUTES.notifications}
            className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-accent no-underline hover:bg-white/5"
            onClick={() => setOpen(false)}
          >
            {t('feed.viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
