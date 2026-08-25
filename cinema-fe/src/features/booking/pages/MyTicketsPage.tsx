import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import { ISSUED_TICKET_STATUS_META } from '@/constants/issuedTicketStatus';
import { useMyTickets } from '../hooks/useMyTickets';

function MyTicketsPage() {
  const { t } = useTranslation('booking');
  const { data: tickets = [], isLoading } = useMyTickets();

  return (
    <AccountLayout title={t('myTickets.pageTitle')}>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}
      {!isLoading && tickets.length === 0 && (
        <EmptyState title={t('myTickets.empty')} icon="fa-solid fa-ticket" />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {tickets.map((ticket) => {
          const status = ISSUED_TICKET_STATUS_META[ticket.status] || ISSUED_TICKET_STATUS_META.ISSUED;
          const seatTypeKey = ticket.seat_type !== null ? SEAT_TYPE_KEY[ticket.seat_type] : undefined;
          return (
            <Link
              key={ticket.ticket_id}
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
        })}
      </div>
    </AccountLayout>
  );
}

export default MyTicketsPage;
