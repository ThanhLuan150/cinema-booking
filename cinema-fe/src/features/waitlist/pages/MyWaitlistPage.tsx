import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { useCancelWaitlistEntry, useMyWaitlist } from '../hooks/useWaitlist';
import { WaitlistEntryCard } from '../components/WaitlistEntryCard';
import type { WaitlistEntry, WaitlistStatus } from '../types/waitlist.types';

const FILTERS: Record<'active' | 'all', WaitlistStatus[] | undefined> = {
  active: ['WAITING', 'NOTIFIED'],
  all: undefined,
};

function MyWaitlistPage() {
  const { t } = useTranslation('waitlist');
  const [filter, setFilter] = useState<keyof typeof FILTERS>('active');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyWaitlist(page, DEFAULT_PAGE_SIZE, FILTERS[filter]);
  const cancel = useCancelWaitlistEntry();
  const entries = data?.data ?? [];

  const handleCancel = async (entry: WaitlistEntry) => {
    const key = entry.status === 'NOTIFIED' ? 'panel.offer.declineConfirm' : 'panel.waiting.leaveConfirm';
    if (!(await confirmDialog(t(key)))) return;
    try {
      await cancel.mutateAsync(entry.id);
      toast.success(t('panel.left'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AccountLayout title={t('mine.pageTitle')}>
      <p className="text-sm text-txt/70">{t('mine.intro')}</p>

      <div className="flex gap-2" role="tablist">
        {(Object.keys(FILTERS) as Array<keyof typeof FILTERS>).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              filter === key ? 'bg-accent text-white' : 'bg-white/5 text-txt/70 hover:bg-white/10',
            )}
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
          >
            {t(`mine.filters.${key}`)}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}
      {!isLoading && entries.length === 0 && <EmptyState title={t('mine.empty')} icon="fa-solid fa-user-clock" />}

      <div className="flex flex-col gap-3">
        {entries.map((entry) => (
          <WaitlistEntryCard key={entry.id} entry={entry} cancelling={cancel.isPending} onCancel={handleCancel} />
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AccountLayout>
  );
}

export default MyWaitlistPage;
