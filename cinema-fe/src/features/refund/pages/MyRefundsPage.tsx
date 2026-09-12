import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyRefunds } from '../hooks/useMyRefunds';
import { RefundCard } from '../components/RefundCard';

function MyRefundsPage() {
  const { t } = useTranslation('refund');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyRefunds(page, DEFAULT_PAGE_SIZE);
  const refunds = data?.data ?? [];

  return (
    <AccountLayout title={t('myRefunds.pageTitle')}>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}
      {!isLoading && refunds.length === 0 && (
        <EmptyState title={t('myRefunds.empty')} icon="fa-solid fa-hand-holding-dollar" />
      )}

      <div className="flex flex-col gap-3">
        {refunds.map((refund) => (
          <RefundCard key={refund.id} refund={refund} />
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AccountLayout>
  );
}

export default MyRefundsPage;
