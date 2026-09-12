import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAdminPayments } from '@/features/payment/hooks/useAdminPayments';
import { useRequestPaymentRefund } from '@/features/payment/hooks/useRequestPaymentRefund';
import { useConfirmPaymentRefund } from '@/features/payment/hooks/useConfirmPaymentRefund';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { ListItem } from '../components/ListItem';

function AdminPaymentsList() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminPayments({ page, limit: DEFAULT_PAGE_SIZE });
  const payments = data?.data ?? [];
  const requestRefundMutation = useRequestPaymentRefund();
  const confirmRefundMutation = useConfirmPaymentRefund();

  const handleRequestRefund = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('payments.refundRequestConfirm')))) return;
      try {
        await requestRefundMutation.mutateAsync({ id });
        toast.success(t('payments.refundRequestSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [requestRefundMutation, t],
  );

  const handleConfirmRefund = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('payments.refundConfirmConfirm')))) return;
      try {
        await confirmRefundMutation.mutateAsync(id);
        toast.success(t('payments.refundConfirmSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [confirmRefundMutation, t],
  );

  return (
    <AdminLayout breadcrumb={t('payments.breadcrumb')} loading={isLoading}>
      <DataTable headers={t('payments.headers', { returnObjects: true }) as unknown as string[]}>
        {payments.map((payment) => (
          <ListItem
            key={payment.id}
            payment={payment}
            onRequestRefund={handleRequestRefund}
            onConfirmRefund={handleConfirmRefund}
          />
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
}

export default AdminPaymentsList;
