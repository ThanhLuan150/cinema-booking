import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import { ISSUED_TICKET_STATUS_META } from '@/constants/issuedTicketStatus';
import type { Ticket } from '../types/booking.types';

export function TicketInfoHeader({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation('booking');
  const status = ISSUED_TICKET_STATUS_META[ticket.status] || ISSUED_TICKET_STATUS_META.ISSUED;
  const seatTypeKey = ticket.seat_type !== null ? SEAT_TYPE_KEY[ticket.seat_type] : undefined;

  return (
    <div className="flex flex-col gap-6 p-6 sm:flex-row">
      <img
        src={getMoviePosterUrl(ticket.movie?.avatar)}
        alt={ticket.movie?.name}
        className="h-[220px] w-[160px] shrink-0 self-center rounded-lg object-cover shadow-card sm:self-start"
      />

      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold text-white">{ticket.movie?.name || t('myBookings.movieFallback')}</h2>
          <span className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-medium', status.className)}>
            {t(`myTickets.status.${status.key}`)}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-txt/50">{t('ticketDetail.showtime')}</dt>
            <dd className="font-medium text-white">
              {ticket.schedule?.movie_date} · {ticket.schedule?.time_begin}
            </dd>
          </div>
          <div>
            <dt className="text-txt/50">{t('ticketDetail.branch')}</dt>
            <dd className="font-medium text-white">{ticket.branch?.name}</dd>
          </div>
          <div>
            <dt className="text-txt/50">{t('ticketDetail.room')}</dt>
            <dd className="font-medium text-white">{ticket.room?.name}</dd>
          </div>
          <div>
            <dt className="text-txt/50">{t('ticketDetail.seat')}</dt>
            <dd className="font-medium text-white">
              {ticket.seat_code} ({t(`myBookings.seatType.${seatTypeKey ?? 'standard'}`)})
            </dd>
          </div>
          {ticket.issued_at && (
            <div>
              <dt className="text-txt/50">{t('ticketDetail.issuedAt')}</dt>
              <dd className="font-medium text-white">{new Date(ticket.issued_at).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
