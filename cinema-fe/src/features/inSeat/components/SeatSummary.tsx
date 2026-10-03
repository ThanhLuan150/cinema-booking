import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/format';
import type { InSeatSession } from '../types/inSeat.types';

/** The seat the server confirmed from the QR: the customer checks they are ordering to the right one. */
export function SeatSummary({ session }: { session: InSeatSession }) {
  const { t } = useTranslation('inSeat');
  const { movie, showtime, room, seat, branch, ticket } = session;

  return (
    <section
      aria-label={t('seat.label')}
      className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card"
    >
      {movie?.avatar && (
        <img src={movie.avatar} alt="" className="h-24 w-16 shrink-0 rounded-lg object-cover" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="truncate text-base font-semibold text-white">{movie?.name ?? branch.name}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-txt/60">{t('seat.seat')}</dt>
          <dd className="text-lg font-bold leading-tight text-accent">{seat.code}</dd>
          <dt className="text-txt/60">{t('seat.room')}</dt>
          <dd>{room.name}</dd>
          <dt className="text-txt/60">{t('seat.showtime')}</dt>
          <dd>
            {showtime.time_begin} – {showtime.time_end} · {formatDate(showtime.date)}
          </dd>
          <dt className="text-txt/60">{t('seat.cinema')}</dt>
          <dd className="truncate">{branch.name}</dd>
        </dl>
        <p className="text-xs text-emerald-300">
          <i className="fa-solid fa-ticket mr-1.5" aria-hidden="true" />
          {ticket.status === 'USED' ? t('seat.checkedIn') : t('seat.ticketValid')}
        </p>
      </div>
    </section>
  );
}
