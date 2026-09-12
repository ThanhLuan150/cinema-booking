import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/cn';
import { POINTS_TRANSACTION_TYPE_META } from '@/constants/pointsTransactionType';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyPointsHistory } from '../hooks/useMyPointsHistory';

export function PointsHistorySection() {
  const { t } = useTranslation('membership');
  const [page, setPage] = useState(1);
  const { data: history, isLoading: historyLoading } = useMyPointsHistory(page, DEFAULT_PAGE_SIZE);
  const transactions = history?.data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
      <h2 className="text-xl font-semibold">{t('history.title')}</h2>

      {historyLoading && <Spinner size="sm" className="mt-3" />}
      {!historyLoading && transactions.length === 0 && (
        <EmptyState title={t('history.empty')} icon="fa-solid fa-coins" />
      )}

      <div className="mt-3 flex flex-col gap-2">
        {transactions.map((tx) => {
          const meta = POINTS_TRANSACTION_TYPE_META[tx.type];
          return (
            <div
              key={tx.id}
              className="flex flex-col gap-1 rounded-xl border border-border bg-surface-soft p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', meta?.className)}>
                  {t(`history.type.${meta?.key ?? 'adjust'}`)}
                </span>
                <p className="mt-1 text-sm text-txt/70">{tx.description}</p>
                <p className="text-xs text-txt/50">{new Date(tx.createdAt).toLocaleString()}</p>
              </div>
              <span className={cn('font-semibold', tx.points >= 0 ? 'text-green-400' : 'text-red-400')}>
                {tx.points >= 0 ? '+' : ''}
                {tx.points.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      <Pagination page={page} totalPages={history?.totalPages ?? 1} onPageChange={setPage} />
    </div>
  );
}
