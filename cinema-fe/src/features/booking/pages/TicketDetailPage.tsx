import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import { ISSUED_TICKET_STATUS_META } from '@/constants/issuedTicketStatus';
import { useTicket } from '../hooks/useTicket';

function TicketDetailPage() {
  const { t } = useTranslation('booking');
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading } = useTicket(id);

  if (isLoading) {
    return (
      <AccountLayout title={t('ticketDetail.pageTitle')}>
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </AccountLayout>
    );
  }

  if (!ticket) {
    return (
      <AccountLayout title={t('ticketDetail.pageTitle')}>
        <EmptyState title={t('ticketDetail.notFound')} icon="fa-solid fa-ticket" />
      </AccountLayout>
    );
  }

  const status = ISSUED_TICKET_STATUS_META[ticket.status] || ISSUED_TICKET_STATUS_META.ISSUED;
  const seatTypeKey = ticket.seat_type !== null ? SEAT_TYPE_KEY[ticket.seat_type] : undefined;

  return (
    <AccountLayout title={t('ticketDetail.pageTitle')}>
      <Link to={ROUTES.myTickets} className="mb-4 inline-flex items-center gap-2 text-sm text-txt/70 no-underline hover:text-txt">
        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        {t('ticketDetail.back')}
      </Link>

      <Card className="overflow-hidden">
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
              <div>
                <dt className="text-txt/50">{t('ticketDetail.bookingCode')}</dt>
                <dd className="font-medium text-white">{ticket.code}</dd>
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

        <CardBody className="flex flex-col items-center gap-3 border-t border-border bg-white/[0.02] py-8">
          <p className="text-sm text-txt/60">{t('ticketDetail.qrHint')}</p>
          {ticket.qr_token ? (
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={ticket.qr_token} size={180} />
            </div>
          ) : (
            <p className="text-sm text-txt/50">{t('ticketDetail.qrUnavailable')}</p>
          )}
        </CardBody>
      </Card>
    </AccountLayout>
  );
}

export default TicketDetailPage;
