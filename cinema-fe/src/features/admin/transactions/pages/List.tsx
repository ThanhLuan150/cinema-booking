import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAdminInvoices } from '../hooks/useAdminInvoices';
import { useRefundInvoice } from '../hooks/useRefundInvoice';
import { INVOICE_STATUS, INVOICE_STATUS_META } from '@/constants/invoiceStatus';

function AdminTransactions() {
  const { t } = useTranslation('admin');
  const { data: invoices = [] } = useAdminInvoices();
  const refundMutation = useRefundInvoice();

  const handleRefund = async (id: number) => {
    if (!(await confirmDialog(t('transactions.refundConfirm')))) return;
    try {
      await refundMutation.mutateAsync(id);
      toast.success(t('transactions.refundSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('transactions.breadcrumb')}>
      <DataTable headers={t('transactions.headers', { returnObjects: true }) as unknown as string[]}>
        {invoices.map((inv) => {
          const status = INVOICE_STATUS_META[inv.status] || INVOICE_STATUS_META[INVOICE_STATUS.booked];
          return (
            <tr key={inv.id}>
              <td>{inv.id}</td>
              <td>{inv.code}</td>
              <td>{inv.account?.email}</td>
              <td>{inv.movie?.name}</td>
              <td>{inv.ticket?.seat_code}</td>
              <td>{inv.total_price.toLocaleString()}đ</td>
              <td>
                <span className={`rounded px-2 py-0.5 text-xs ${status.className}`}>{t(`transactions.status.${status.key}`)}</span>
              </td>
              <td>
                {inv.status === INVOICE_STATUS.booked && (
                  <button type="button" className="text-accent" onClick={() => handleRefund(inv.id)}>
                    {t('transactions.refundButton')}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
    </AdminLayout>
  );
}

export default AdminTransactions;
