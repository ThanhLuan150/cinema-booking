import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ROUTES } from '@/constants/routes';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import type { PrivateEventStatus } from '@/types/entities';
import { useCancelMyPrivateEvent, useMyPrivateEvents, usePayPrivateEvent } from '../hooks/usePrivateEvents';

const STATUS_VARIANT: Record<PrivateEventStatus, 'default' | 'warning' | 'success'> = {
  REQUESTED: 'warning',
  QUOTED: 'warning',
  APPROVED: 'warning',
  PAID: 'success',
  CONFIRMED: 'success',
  COMPLETED: 'default',
  CANCELLED: 'default',
};

function MyEventsPage() {
  const { t } = useTranslation('privateEvents');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyPrivateEvents(page, DEFAULT_PAGE_SIZE);
  const events = data?.data ?? [];

  const pay = usePayPrivateEvent();
  const cancel = useCancelMyPrivateEvent();

  const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

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
          <div
            key={ev.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-white">
                {ev.title || t('mine.untitled', { id: ev.id })}
              </p>
              <p className="text-sm text-txt/70">
                {t('mine.window', { start: fmt(ev.start_at), end: fmt(ev.end_at) })}
              </p>
              <p className="text-xs text-txt/55">
                {t('mine.meta', { branch: ev.branch_id, room: ev.room_id, guests: ev.guest_count })}
              </p>
              {ev.quoted_amount != null && (
                <p className="mt-1 text-sm text-white">
                  {t('mine.quote', { amount: ev.quoted_amount.toLocaleString() })}
                </p>
              )}
              {ev.status === 'CANCELLED' && ev.cancel_reason && (
                <p className="mt-1 text-sm text-red-400">{t('mine.cancelReason', { reason: ev.cancel_reason })}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant={STATUS_VARIANT[ev.status]}>{t(`status.${ev.status}`)}</Badge>
              {ev.status === 'APPROVED' && (
                <Button type="button" size="sm" variant="danger" loading={pay.isPending} onClick={() => handlePay(ev.id)}>
                  {t('mine.payNow')}
                </Button>
              )}
              {['REQUESTED', 'QUOTED', 'APPROVED', 'PAID'].includes(ev.status) && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 hover:text-red-400"
                  onClick={() => handleCancel(ev.id)}
                >
                  {t('mine.cancel')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AccountLayout>
  );
}

export default MyEventsPage;
