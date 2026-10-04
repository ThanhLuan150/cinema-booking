import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { TicketInfoHeader } from '../components/TicketInfoHeader';
import { TicketQrPanel } from '../components/TicketQrPanel';
import { SeatSwapModal } from '../components/SeatSwapModal';
import { useTicket } from '../hooks/useTicket';
import type { Ticket } from '../types/booking.types';

function TicketDetailPage() {
  const { t } = useTranslation('booking');
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading } = useTicket(id);
  const [swapOpen, setSwapOpen] = useState(false);
  const seatSwaps = ticket?.seat_swaps ?? [];

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

  return (
    <AccountLayout title={t('ticketDetail.pageTitle')}>
      <Link
        to={ROUTES.myTickets}
        className="mb-4 inline-flex items-center gap-2 text-sm text-txt/70 no-underline hover:text-txt"
      >
        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        {t('ticketDetail.back')}
      </Link>

      <Card className="overflow-hidden">
        <TicketInfoHeader ticket={ticket} />
        {canRequestSeatChange(ticket) && (
          <div className="flex justify-end px-6 pb-2">
            <Button type="button" variant="secondary" onClick={() => setSwapOpen(true)}>
              <i className="fa-solid fa-couch mr-2" aria-hidden="true" />
              {t('seatSwap.open')}
            </Button>
          </div>
        )}
        {seatSwaps.length > 0 && (
          <div className="px-6 pb-2 text-sm text-txt/70">
            <p className="font-medium text-txt/90">{t('seatSwap.history.title')}</p>
            <ul className="mt-1 space-y-1">
              {seatSwaps.map((s) => (
                <li key={`${s.from_seat_code}-${s.to_seat_code}-${s.swapped_at}`}>
                  {t('seatSwap.history.entry', {
                    from: s.from_seat_code,
                    to: s.to_seat_code,
                    at: new Date(s.swapped_at).toLocaleString(),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <TicketQrPanel qrToken={ticket.qr_token} />
      </Card>

      {swapOpen && <SeatSwapModal ticket={ticket} onClose={() => setSwapOpen(false)} />}
    </AccountLayout>
  );
}

// Only offered for a ticket that can still be used and whose showtime has not started (local time,
// like every movie_date/time_begin pair). The server re-checks all of it plus the branch's policy.
function canRequestSeatChange(ticket: Ticket) {
  if (ticket.status !== 'ISSUED' || !ticket.schedule) return false;
  const startsAt = new Date(
    `${ticket.schedule.movie_date}T${ticket.schedule.time_begin}:00`,
  ).getTime();
  return Number.isFinite(startsAt) && startsAt > Date.now();
}

export default TicketDetailPage;
