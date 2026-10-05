import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { STATUS_VARIANT, entrySeatPageUrl, isActive } from '../lib/waitlist';
import type { WaitlistEntry } from '../types/waitlist.types';

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

interface WaitlistEntryCardProps {
  entry: WaitlistEntry;
  cancelling: boolean;
  onCancel: (entry: WaitlistEntry) => void;
}

export function WaitlistEntryCard({ entry, cancelling, onCancel }: WaitlistEntryCardProps) {
  const { t } = useTranslation('waitlist');
  const seatPage = entrySeatPageUrl(entry);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-white">{entry.movie?.name ?? t('mine.unknownMovie')}</p>
        {entry.showtime && (
          <p className="text-sm text-txt/70">
            {t('mine.showtime', {
              date: entry.showtime.movie_date,
              time: entry.showtime.time_begin,
              branch: entry.branch?.name ?? '',
              room: entry.showtime.room ?? '',
            })}
          </p>
        )}
        <p className="text-xs text-txt/55">
          {t('mine.meta', { count: entry.seat_count, joined: fmt(entry.joined_at) })}
        </p>
        {entry.status === 'WAITING' && entry.position && (
          <p className="mt-1 text-sm text-amber-300">{t('mine.position', { position: entry.position })}</p>
        )}
        {entry.status === 'NOTIFIED' && (
          <p className="mt-1 text-sm text-white">
            {t('mine.offer', { seats: entry.offered_seat_codes.join(', '), until: fmt(entry.expires_at) })}
          </p>
        )}
        {entry.close_reason && entry.close_reason !== 'CUSTOMER_CANCELLED' && (
          <p className="mt-1 text-sm text-txt/60">{t(`closeReason.${entry.close_reason}`)}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Badge variant={STATUS_VARIANT[entry.status]}>{t(`status.${entry.status}`)}</Badge>
        {entry.status === 'NOTIFIED' && seatPage && (
          <Link to={seatPage}>
            <Button type="button" size="sm" variant="danger">
              {t('mine.bookNow')}
            </Button>
          </Link>
        )}
        {entry.status === 'BOOKED' && (
          <Link to={ROUTES.myBookings} className="text-sm font-medium text-accent">
            {t('mine.viewBooking')}
          </Link>
        )}
        {isActive(entry) && (
          <button
            type="button"
            className="text-sm font-medium text-red-500 hover:text-red-400"
            onClick={() => onCancel(entry)}
            disabled={cancelling}
          >
            {entry.status === 'NOTIFIED' ? t('mine.decline') : t('mine.leave')}
          </button>
        )}
      </div>
    </div>
  );
}
