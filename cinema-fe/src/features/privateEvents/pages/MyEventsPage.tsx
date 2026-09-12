import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ROUTES } from '@/constants/routes';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCancelMyPrivateEvent, useMyPrivateEvents, usePayPrivateEvent } from '../hooks/usePrivateEvents';
import { MyEventCard } from '../components/MyEventCard';

function MyEventsPage() {
  const { t } = useTranslation('privateEvents');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyPrivateEvents(page, DEFAULT_PAGE_SIZE);
  const events = data?.data ?? [];

  const pay = usePayPrivateEvent();
  const cancel = useCancelMyPrivateEvent();

  const handlePay = async (id: number) => {
    try {
      await pay.mutateAsync({ id });
      toast.success(t('mine.paid'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleCancel = async (id: number) => {
    if (!(await confirmDialog(t('mine.cancelConfirm')))) return;
    try {
      await cancel.mutateAsync({ id, arg: undefined });
      toast.success(t('mine.cancelled'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AccountLayout title={t('mine.pageTitle')}>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-txt/70">{t('mine.intro')}</p>
        <Link to={ROUTES.requestPrivateEvent}>
          <Button type="button" variant="danger" size="sm">
            {t('mine.newRequest')}
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}
      {!isLoading && events.length === 0 && (
        <EmptyState title={t('mine.empty')} icon="fa-solid fa-champagne-glasses" />
      )}

      <div className="flex flex-col gap-3">
        {events.map((ev) => (
          <MyEventCard key={ev.id} event={ev} payPending={pay.isPending} onPay={handlePay} onCancel={handleCancel} />
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AccountLayout>
  );
}

export default MyEventsPage;
