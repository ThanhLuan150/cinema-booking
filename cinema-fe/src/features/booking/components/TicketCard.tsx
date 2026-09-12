import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import { ISSUED_TICKET_STATUS_META } from '@/constants/issuedTicketStatus';
import type { Ticket } from '../types/booking.types';

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation('booking');
  const status = ISSUED_TICKET_STATUS_META[ticket.status] || ISSUED_TICKET_STATUS_META.ISSUED;
  const seatTypeKey = ticket.seat_type !== null ? SEAT_TYPE_KEY[ticket.seat_type] : undefined;

  return (
    <Link
      to={ROUTES.ticketDetail(ticket.ticket_id)}
      className="flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-card no-underline transition-colors hover:border-border-strong"
    >
      <img
        src={getMoviePosterUrl(ticket.movie?.avatar)}
        alt={ticket.movie?.name}
        className="h-[140px] w-[100px] shrink-0 rounded-lg object-cover shadow-card"
      />
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <h6 className="text-lg font-semibold text-white">
            {ticket.movie?.name || t('myBookings.movieFallback')}
          </h6>
          <span
            className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', status.className)}
          >
            {t(`myTickets.status.${status.key}`)}
          </span>
        </div>
        <p className="mt-1 text-sm text-txt/70">
          {ticket.schedule?.movie_date} · {ticket.schedule?.time_begin}
        </p>
        <p className="text-sm text-txt/70">{ticket.branch?.name}</p>
        <p className="text-sm text-txt/70">
          {t('myTickets.seatLabel', {
            code: ticket.seat_code,
            type: t(`myBookings.seatType.${seatTypeKey ?? 'standard'}`),
          })}
          {ticket.room?.name ? ` · ${ticket.room.name}` : ''}
        </p>
        <p className="mt-2 text-xs text-txt/50">{t('myTickets.viewDetail')}</p>
      </div>
    </Link>
  );
}
