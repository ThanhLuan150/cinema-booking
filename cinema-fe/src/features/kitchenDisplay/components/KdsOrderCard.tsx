import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { KdsOrder, KdsStatus, KdsTargetStatus } from '../types/kds.types';
import {
  KDS_STATUS_CLASS,
  canCancel,
  formatClock,
  minutesSince,
  primaryNextStatus,
  urgencyOf,
} from '../utils/kdsBoard';

const URGENCY_CLASS = {
  normal: 'border-border-strong',
  warning: 'border-amber-500/70',
  late: 'border-red-500/80 shadow-[0_0_0_1px_rgba(239,68,68,0.5)]',
} as const;

const WAIT_CLASS = {
  normal: 'text-txt/70',
  warning: 'text-amber-400',
  late: 'text-red-400',
} as const;

// The timeline rows a card shows: every step up to where the order is now.
const TIMELINE: KdsStatus[] = ['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

export interface KdsOrderCardProps {
  order: KdsOrder;
  nowMs: number;
  canUpdate: boolean;
  pending: boolean;
  /** Can be dragged into its next lane (drag is an alternative to the advance button). */
  draggable?: boolean;
  /** This card is the one currently being dragged (its floating copy follows the pointer). */
  dragging?: boolean;
  /** Moved on screen already, waiting for the server to confirm. */
  saving?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onAdvance: (order: KdsOrder, status: KdsTargetStatus) => void;
  onCancel: (order: KdsOrder) => void;
}

export function KdsOrderCard({
  order,
  nowMs,
  canUpdate,
  pending,
  draggable = false,
  dragging = false,
  saving = false,
  onPointerDown,
  onAdvance,
  onCancel,
}: KdsOrderCardProps) {
  const { t, i18n } = useTranslation('kitchenDisplay');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const urgency = urgencyOf(order, nowMs);
  const next = primaryNextStatus(order);
  const isActive =
    order.status === 'NEW' || order.status === 'PREPARING' || order.status === 'READY';
  const waited = minutesSince(order.timestamps.NEW, nowMs);

  return (
    <article
      aria-label={t('card.label', { code: order.code })}
      data-status={order.status}
      data-urgency={urgency}
      data-draggable={draggable || undefined}
      data-saving={saving || undefined}
      title={draggable ? t('card.dragHint') : undefined}
      onPointerDown={draggable ? onPointerDown : undefined}
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-surface-raised p-4 shadow-card transition-opacity',
        URGENCY_CLASS[urgency],
        !isActive && 'opacity-75',
        // pan-y: a vertical swipe still scrolls the lane on a tablet; a sideways drag moves the card.
        draggable && 'cursor-grab select-none touch-pan-y',
        dragging && 'border-dashed opacity-40',
        saving && 'animate-pulse',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold tracking-wide">
            {draggable && (
              <i className="fa-solid fa-grip-vertical text-sm text-txt/40" aria-hidden="true" />
            )}
            {order.code}
          </h3>
          <p className="text-xs text-txt/60">
            {t('card.createdAt', { time: formatClock(order.created_at, locale) })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              KDS_STATUS_CLASS[order.status],
            )}
          >
            {t(`status.${order.status}`)}
          </span>
          {saving && <span className="text-xs text-txt/60">{t('card.saving')}</span>}
          {isActive && (
            <span className={cn('text-sm font-semibold tabular-nums', WAIT_CLASS[urgency])}>
              {t('card.waiting', { minutes: waited })}
            </span>
          )}
        </div>
      </header>

      <ul className="flex flex-col gap-1" aria-label={t('card.items', { count: order.item_count })}>
        {order.items.map((item) => (
          <li key={`${item.combo_id}-${item.name}`} className="flex items-baseline gap-2 text-base">
            <span className="min-w-[2.5rem] rounded bg-white/10 px-1.5 text-center font-bold tabular-nums">
              {item.quantity}×
            </span>
            <span className="font-medium">{item.name}</span>
          </li>
        ))}
      </ul>

      {(order.customer || order.booking) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg bg-white/5 px-3 py-2 text-sm">
          {order.customer && (
            <>
              <dt className="text-txt/60">{t('card.customer')}</dt>
              <dd>{order.customer.name || t('card.customerNoName', { id: order.customer.id })}</dd>
            </>
          )}
          {order.booking && order.booking.seats.length > 0 && (
            <>
              <dt className="text-txt/60">{t('card.seats')}</dt>
              <dd className="font-semibold">{order.booking.seats.join(', ')}</dd>
            </>
          )}
          {order.booking?.room && (
            <>
              <dt className="text-txt/60">{t('card.room')}</dt>
              <dd>{order.booking.room}</dd>
            </>
          )}
          {order.booking?.showtime && (
            <>
              <dt className="text-txt/60">{t('card.showtime')}</dt>
              <dd>{order.booking.showtime.time}</dd>
            </>
          )}
        </dl>
      )}

      <ol
        className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-txt/60"
        aria-label={t('card.timeline')}
      >
        {TIMELINE.filter((status) => order.timestamps[status]).map((status) => (
          <li key={status}>
            {t(`status.${status}`)} {formatClock(order.timestamps[status], locale)}
          </li>
        ))}
      </ol>

      {order.status === 'CANCELLED' && order.cancel_reason && (
        <p className="text-sm text-red-300">{t('card.reason', { reason: order.cancel_reason })}</p>
      )}

      {canUpdate && (next || canCancel(order)) && (
        <div className="mt-auto flex gap-2">
          {next && (
            <Button
              type="button"
              size="sm"
              variant={next === 'COMPLETED' ? 'success' : 'primary'}
              className="flex-1"
              loading={pending}
              onClick={() => onAdvance(order, next)}
            >
              {t(`actions.${next}`)}
            </Button>
          )}
          {canCancel(order) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => onCancel(order)}
            >
              {t('actions.cancel')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
