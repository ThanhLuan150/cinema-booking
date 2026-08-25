import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/cn';
import { REFUND_STATUS_META } from '@/constants/refundStatus';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyRefunds } from '../hooks/useMyRefunds';

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
        {refunds.map((refund) => {
          const status = REFUND_STATUS_META[refund.status];
          return (
            <div
              key={refund.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-white">{t('myRefunds.bookingLabel', { id: refund.booking_id })}</p>
                <p className="text-sm text-txt/70">
                  {t('myRefunds.requestedAt', {
                    date: refund.requested_at ? new Date(refund.requested_at).toLocaleString() : '',
                  })}
                </p>
                {refund.status === 'REJECTED' && refund.decision_reason && (
                  <p className="mt-1 text-sm text-red-400">
                    {t('myRefunds.rejectionReason', { reason: refund.decision_reason })}
                  </p>
                )}
                {refund.status === 'FAILED' && refund.failure_reason && (
                  <p className="mt-1 text-sm text-red-400">
                    {t('myRefunds.failureReason', { reason: refund.failure_reason })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">{refund.amount.toLocaleString()}đ</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    status?.className,
                  )}
                >
                  {t(`myRefunds.status.${status?.key ?? 'requested'}`)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AccountLayout>
  );
}

export default MyRefundsPage;
