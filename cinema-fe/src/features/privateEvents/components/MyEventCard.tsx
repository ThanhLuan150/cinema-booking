import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { PrivateEvent } from '@/types/entities';
import { STATUS_VARIANT } from '../constants';

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

interface MyEventCardProps {
  event: PrivateEvent;
  payPending: boolean;
  onPay: (id: number) => void;
  onCancel: (id: number) => void;
}

export function MyEventCard({ event: ev, payPending, onPay, onCancel }: MyEventCardProps) {
  const { t } = useTranslation('privateEvents');

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-white">
          {ev.title || t('mine.untitled', { id: ev.id })}
        </p>
        <p className="text-sm text-txt/70">
          {t('mine.window', { start: fmt(ev.start_at), end: fmt(ev.end_at) })}
        </p>
        <p className="text-xs text-txt/55">
          {t('mine.meta', { branch: ev.branch_id, room: ev.room_id, guests: ev.guest_count })}
        </p>
        {ev.quoted_amount != null && (
          <p className="mt-1 text-sm text-white">
            {t('mine.quote', { amount: ev.quoted_amount.toLocaleString() })}
          </p>
        )}
        {ev.status === 'CANCELLED' && ev.cancel_reason && (
          <p className="mt-1 text-sm text-red-400">{t('mine.cancelReason', { reason: ev.cancel_reason })}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge variant={STATUS_VARIANT[ev.status]}>{t(`status.${ev.status}`)}</Badge>
        {ev.status === 'APPROVED' && (
          <Button type="button" size="sm" variant="danger" loading={payPending} onClick={() => onPay(ev.id)}>
            {t('mine.payNow')}
          </Button>
        )}
        {['REQUESTED', 'QUOTED', 'APPROVED', 'PAID'].includes(ev.status) && (
          <button
            type="button"
            className="text-sm font-medium text-red-500 hover:text-red-400"
            onClick={() => onCancel(ev.id)}
          >
            {t('mine.cancel')}
          </button>
        )}
      </div>
    </div>
  );
}
