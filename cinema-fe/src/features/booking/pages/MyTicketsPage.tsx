import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { TicketCard } from '../components/TicketCard';
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
        {tickets.map((ticket) => (
          <TicketCard key={ticket.ticket_id} ticket={ticket} />
        ))}
      </div>
    </AccountLayout>
  );
}

export default MyTicketsPage;
