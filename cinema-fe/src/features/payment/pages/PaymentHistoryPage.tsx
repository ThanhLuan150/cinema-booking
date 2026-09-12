import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyPayments } from '../hooks/useMyPayments';
import { PaymentCard } from '../components/PaymentCard';

function PaymentHistoryPage() {
  const { t } = useTranslation('payment');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyPayments(page, DEFAULT_PAGE_SIZE);
  const payments = data?.data ?? [];

  return (
    <AccountLayout title={t('history.pageTitle')}>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}
      {!isLoading && payments.length === 0 && (
        <EmptyState title={t('history.empty')} icon="fa-solid fa-receipt" />
      )}

      <div className="flex flex-col gap-3">
        {payments.map((payment) => (
          <PaymentCard key={payment.id} payment={payment} />
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AccountLayout>
  );
}

export default PaymentHistoryPage;
