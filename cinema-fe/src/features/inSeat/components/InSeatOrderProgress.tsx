import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { InSeatOrder, InSeatOrderStatus } from '../types/inSeat.types';
import { ORDER_TRACK, trackIndex } from '../utils/inSeatCart';
import { IN_SEAT_STATUS_CLASS } from '../constants';

const STEP_TIME: Record<string, keyof InSeatOrder> = {
  PAID: 'paid_at',
  PREPARING: 'prepared_at',
  READY: 'ready_at',
  DELIVERED: 'delivered_at',
};

function clock(value: string | null, locale: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

export function InSeatStatusBadge({ status }: { status: InSeatOrderStatus }) {
  const { t } = useTranslation('inSeat');
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
        IN_SEAT_STATUS_CLASS[status],
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}

/** Paid -> Preparing -> Ready -> Delivered, each step stamped with the time it happened. */
export function InSeatOrderProgress({ order }: { order: InSeatOrder }) {
  const { t, i18n } = useTranslation('inSeat');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const current = trackIndex(order.status);
  if (current < 0) return null;

  return (
    <ol aria-label={t('track.progress')} className="grid grid-cols-4 gap-2">
      {ORDER_TRACK.map((step, index) => {
        const done = index <= current;
        const time = clock(order[STEP_TIME[step]] as string | null, locale);
        return (
          <li
            key={step}
            aria-current={index === current ? 'step' : undefined}
            className="flex flex-col items-center gap-1 text-center"
          >
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold',
                done ? 'border-accent bg-accent text-white' : 'border-border-strong text-txt/40',
                index === current && order.status !== 'DELIVERED' && 'animate-pulse',
              )}
            >
              {done ? <i className="fa-solid fa-check" aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn('text-xs font-medium', done ? 'text-white' : 'text-txt/50')}>
              {t(`track.steps.${step}`)}
            </span>
            {time && <span className="text-[11px] tabular-nums text-txt/50">{time}</span>}
          </li>
        );
      })}
    </ol>
  );
}
