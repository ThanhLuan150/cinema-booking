import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Card } from '@/components/ui/Card';
import { ROUTES } from '@/constants/routes';
import { TicketInfoHeader } from '../components/TicketInfoHeader';
import { TicketQrPanel } from '../components/TicketQrPanel';
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

  return (
    <AccountLayout title={t('ticketDetail.pageTitle')}>
      <Link to={ROUTES.myTickets} className="mb-4 inline-flex items-center gap-2 text-sm text-txt/70 no-underline hover:text-txt">
        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        {t('ticketDetail.back')}
      </Link>

      <Card className="overflow-hidden">
        <TicketInfoHeader ticket={ticket} />
        <TicketQrPanel qrToken={ticket.qr_token} />
      </Card>
    </AccountLayout>
  );
}

export default TicketDetailPage;
