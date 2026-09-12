import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAdminRefunds } from '@/features/refund/hooks/useAdminRefunds';
import { useApproveRefund } from '@/features/refund/hooks/useApproveRefund';
import { useRejectRefund } from '@/features/refund/hooks/useRejectRefund';
import { useProcessRefund } from '@/features/refund/hooks/useProcessRefund';
import { useCompleteRefund } from '@/features/refund/hooks/useCompleteRefund';
import { useFailRefund } from '@/features/refund/hooks/useFailRefund';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { ListItem } from '../components/ListItem';
import { ReasonModal } from '../components/ReasonModal';
import type { ReasonModalState } from '../types/adminRefund.types';

function AdminRefundsList() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminRefunds({ page, limit: DEFAULT_PAGE_SIZE });
  const refunds = data?.data ?? [];

  const approveMutation = useApproveRefund();
  const rejectMutation = useRejectRefund();
  const processMutation = useProcessRefund();
  const completeMutation = useCompleteRefund();
  const failMutation = useFailRefund();

  const [reasonModal, setReasonModal] = useState<ReasonModalState | null>(null);
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
        {refunds.map((refund) => (
          <ListItem
            key={refund.id}
            refund={refund}
            onApprove={handleApprove}
            onReject={(id) => openReasonModal(id, 'reject')}
            onProcess={handleProcess}
            onComplete={handleComplete}
            onFail={(id) => openReasonModal(id, 'fail')}
          />
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      <ReasonModal
        reasonModal={reasonModal}
        reasonText={reasonText}
        onReasonTextChange={setReasonText}
        onClose={() => setReasonModal(null)}
        onSubmit={submitReason}
        isSubmitting={isSubmittingReason}
      />
    </AdminLayout>
  );
}

export default AdminRefundsList;
