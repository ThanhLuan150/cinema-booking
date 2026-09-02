import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/hooks/usePermissions';
import { useAdminRefunds } from '@/features/refund/hooks/useAdminRefunds';
import { useApproveRefund } from '@/features/refund/hooks/useApproveRefund';
import { useRejectRefund } from '@/features/refund/hooks/useRejectRefund';
import { useProcessRefund } from '@/features/refund/hooks/useProcessRefund';
import { useCompleteRefund } from '@/features/refund/hooks/useCompleteRefund';
import { useFailRefund } from '@/features/refund/hooks/useFailRefund';
import { REFUND_STATUS, REFUND_STATUS_META } from '@/constants/refundStatus';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

function AdminRefundsList() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminRefunds({ page, limit: DEFAULT_PAGE_SIZE });
  const refunds = data?.data ?? [];
  const { hasPermission } = usePermissions();

  const approveMutation = useApproveRefund();
  const rejectMutation = useRejectRefund();
  const processMutation = useProcessRefund();
  const completeMutation = useCompleteRefund();
  const failMutation = useFailRefund();

  const [reasonModal, setReasonModal] = useState<{ id: number; kind: 'reject' | 'fail' } | null>(null);
  const [reasonText, setReasonText] = useState('');

  const handleApprove = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('refunds.approveConfirm')))) return;
      try {
        await approveMutation.mutateAsync({ id });
        toast.success(t('refunds.approveSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [approveMutation, t],
  );

  const handleProcess = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('refunds.processConfirm')))) return;
      try {
        await processMutation.mutateAsync(id);
        toast.success(t('refunds.processSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [processMutation, t],
  );

  const handleComplete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('refunds.completeConfirm')))) return;
      try {
        await completeMutation.mutateAsync(id);
        toast.success(t('refunds.completeSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [completeMutation, t],
  );

  const openReasonModal = (id: number, kind: 'reject' | 'fail') => {
    setReasonText('');
    setReasonModal({ id, kind });
  };

  const submitReason = async () => {
    if (!reasonModal || !reasonText.trim()) return;
    try {
      if (reasonModal.kind === 'reject') {
        await rejectMutation.mutateAsync({ id: reasonModal.id, reason: reasonText.trim() });
        toast.success(t('refunds.rejectSuccess'));
      } else {
        await failMutation.mutateAsync({ id: reasonModal.id, reason: reasonText.trim() });
        toast.success(t('refunds.failSuccess'));
      }
      setReasonModal(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const isSubmittingReason = rejectMutation.isPending || failMutation.isPending;

  return (
    <AdminLayout breadcrumb={t('refunds.breadcrumb')} loading={isLoading}>
      <DataTable headers={t('refunds.headers', { returnObjects: true }) as unknown as string[]}>
        {refunds.map((refund) => {
          const status = REFUND_STATUS_META[refund.status];
          return (
            <tr key={refund.id}>
              <td>{refund.id}</td>
              <td>{refund.booking_id}</td>
              <td>{refund.amount.toLocaleString()}đ</td>
              <td>{refund.policy_percent}%</td>
              <td>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide', status?.className)}>
                  {t(`refunds.status.${status?.key ?? 'requested'}`)}
                </span>
              </td>
              <td>
                <div className="flex flex-wrap gap-3">
                  {hasPermission('refund.approve') && refund.status === REFUND_STATUS.requested && (
                    <>
                      <button
                        type="button"
                        className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                        onClick={() => handleApprove(refund.id)}
                      >
                        {t('refunds.approveButton')}
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                        onClick={() => openReasonModal(refund.id, 'reject')}
                      >
                        {t('refunds.rejectButton')}
                      </button>
                    </>
                  )}
                  {hasPermission('refund.process') && refund.status === REFUND_STATUS.approved && (
                    <button
                      type="button"
                      className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                      onClick={() => handleProcess(refund.id)}
                    >
                      {t('refunds.processButton')}
                    </button>
                  )}
                  {hasPermission('refund.process') && refund.status === REFUND_STATUS.processing && (
                    <>
                      <button
                        type="button"
                        className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                        onClick={() => handleComplete(refund.id)}
                      >
                        {t('refunds.completeButton')}
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                        onClick={() => openReasonModal(refund.id, 'fail')}
                      >
                        {t('refunds.failButton')}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      <Modal
        open={reasonModal !== null}
        onClose={() => setReasonModal(null)}
        title={reasonModal?.kind === 'reject' ? t('refunds.rejectModalTitle') : t('refunds.failModalTitle')}
      >
        <Textarea
          label={t('refunds.reasonLabel')}
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          rows={4}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setReasonModal(null)}>
            {t('common:actions.close')}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={isSubmittingReason}
            disabled={!reasonText.trim()}
            onClick={submitReason}
          >
            {t('common:actions.confirm')}
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}

export default AdminRefundsList;
