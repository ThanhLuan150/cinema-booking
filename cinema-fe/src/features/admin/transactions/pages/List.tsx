import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAdminInvoices } from '../hooks/useAdminInvoices';
import { useRefundInvoice } from '../hooks/useRefundInvoice';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { ListItem } from '../components/ListItem';

function AdminTransactions() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminInvoices(page, DEFAULT_PAGE_SIZE);
  const invoices = data?.data ?? [];
  const refundMutation = useRefundInvoice();

  const handleRefund = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('transactions.refundConfirm')))) return;
      try {
        await refundMutation.mutateAsync(id);
        toast.success(t('transactions.refundSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [refundMutation, t],
  );

  return (
    <AdminLayout breadcrumb={t('transactions.breadcrumb')} loading={isLoading}>
      <DataTable headers={t('transactions.headers', { returnObjects: true }) as unknown as string[]}>
        {invoices.map((inv) => (
          <ListItem key={inv.id} invoice={inv} onRefund={handleRefund} />
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
}

export default AdminTransactions;
