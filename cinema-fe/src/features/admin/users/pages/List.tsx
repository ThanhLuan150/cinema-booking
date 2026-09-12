import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { CustomerCrmModal } from '@/features/crm/components/CustomerCrmModal';
import { useAdminUsers } from '../hooks/useAdminUsers';
import { useApproveUser } from '../hooks/useApproveUser';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { ListItem } from '../components/ListItem';
import type { User } from '@/types/entities';

const List = () => {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers(page, DEFAULT_PAGE_SIZE);
  const users = data?.data ?? [];
  const approveUserMutation = useApproveUser();
  const { hasPermission } = usePermissions();
  const [crmCustomer, setCrmCustomer] = useState<{ id: number; name: string } | null>(null);
  const canViewCrm = hasPermission('crm.viewCustomer');

  const handleApprove = useCallback(
    async (userId: number) => {
      try {
        await approveUserMutation.mutateAsync(userId);
        toast.success(t('users.list.approveSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [approveUserMutation, t],
  );

  return (
    <AdminLayout breadcrumb={t('users.list.breadcrumb')} loading={isLoading}>
      <DataTable headers={t('users.list.headers', { returnObjects: true }) as unknown as string[]}>
        {users.map((user) => (
          <ListItem
            key={user.id}
            user={user}
            canViewCrm={canViewCrm}
            onViewCrm={(u: User) => setCrmCustomer({ id: u.id, name: u.name || u.email })}
            onApprove={handleApprove}
            approvePending={approveUserMutation.isPending}
          />
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      <CustomerCrmModal
        accountId={crmCustomer?.id ?? null}
        customerName={crmCustomer?.name}
        onClose={() => setCrmCustomer(null)}
      />
    </AdminLayout>
  );
};

export default List;
