import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/cn';
import { PAYMENT_STATUS_META, PAYMENT_TYPE_META } from '@/constants/paymentStatus';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyPayments } from '../hooks/useMyPayments';

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
        {payments.map((payment) => {
          const status = PAYMENT_STATUS_META[payment.status];
          const type = PAYMENT_TYPE_META[payment.type];
          return (
            <div
              key={payment.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-white">{payment.code}</p>
                <p className="text-sm text-txt/70">
                  {t(`history.type.${type?.key ?? 'online'}`)} ·{' '}
                  {new Date(payment.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">{payment.amount.toLocaleString()}đ</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                    status?.className,
                  )}
                >
                  {t(`history.status.${status?.key ?? 'pending'}`)}
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

export default PaymentHistoryPage;
