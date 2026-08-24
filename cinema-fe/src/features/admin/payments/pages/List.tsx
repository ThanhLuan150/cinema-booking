import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { useAdminPayments } from '@/features/payment/hooks/useAdminPayments';
import { useRequestPaymentRefund } from '@/features/payment/hooks/useRequestPaymentRefund';
import { useConfirmPaymentRefund } from '@/features/payment/hooks/useConfirmPaymentRefund';
import { PAYMENT_STATUS, PAYMENT_STATUS_META, PAYMENT_TYPE_META } from '@/constants/paymentStatus';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

function AdminPaymentsList() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const { data } = useAdminPayments({ page, limit: DEFAULT_PAGE_SIZE });
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
    <AdminLayout breadcrumb={t('payments.breadcrumb')}>
      <DataTable headers={t('payments.headers', { returnObjects: true }) as unknown as string[]}>
        {payments.map((payment) => {
          const status = PAYMENT_STATUS_META[payment.status];
          const type = PAYMENT_TYPE_META[payment.type];
          return (
            <tr key={payment.id}>
              <td>{payment.id}</td>
              <td>{payment.code}</td>
              <td>{t(`payments.type.${type?.key ?? 'online'}`)}</td>
              <td>{payment.amount.toLocaleString()}đ</td>
              <td>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide', status?.className)}>
                  {t(`payments.status.${status?.key ?? 'pending'}`)}
                </span>
              </td>
              <td>
                {payment.status === PAYMENT_STATUS.paid && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleRequestRefund(payment.id)}
                  >
                    {t('payments.requestRefundButton')}
                  </button>
                )}
                {payment.status === PAYMENT_STATUS.refundPending && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleConfirmRefund(payment.id)}
                  >
                    {t('payments.confirmRefundButton')}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
}

export default AdminPaymentsList;
