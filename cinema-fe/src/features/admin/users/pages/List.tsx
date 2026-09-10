import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { CustomerCrmModal } from '@/features/crm/components/CustomerCrmModal';
import { useAdminUsers } from '../hooks/useAdminUsers';
import { useApproveUser } from '../hooks/useApproveUser';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

const ROLE_KEY: Record<number, string> = {
  [ROLES.admin]: 'admin',
  [ROLES.customer]: 'user',
  [ROLES.owner]: 'theater',
  [ROLES.employee]: 'employee',
};

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
          <tr key={user.id}>
            <td>{user.id}</td>
            <td>{user.name}</td>
            <td>{user.phone}</td>
            <td>{user.email}</td>
            <td>
              <Badge variant="default">{t(`users.list.roles.${ROLE_KEY[user.role] ?? 'user'}`)}</Badge>
            </td>
            <td>
              <div className="flex flex-wrap items-center gap-1.5">
                {user.status ? (
                  <Badge variant="success">{t('users.list.statusActive')}</Badge>
                ) : (
                  <Badge variant="default">{t('users.list.statusInactive')}</Badge>
                )}
                {user.role === ROLES.owner && !user.approved && (
                  <Badge variant="warning">{t('users.list.pendingApproval')}</Badge>
                )}
              </div>
            </td>
            <td>
              <div className="flex items-center gap-1">
                {canViewCrm && user.role === ROLES.customer && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-accent hover:bg-accent/10 hover:text-accent-hover"
                    title={t('users.list.viewCrm', { defaultValue: 'View activity' })}
                    onClick={() => setCrmCustomer({ id: user.id, name: user.name || user.email })}
                  >
                    <ion-icon name="stats-chart-outline" style={{ fontSize: '1.1rem' }} />
                  </Button>
                )}
                {user.role === ROLES.owner && !user.approved && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={approveUserMutation.isPending}
                    onClick={() => handleApprove(user.id)}
                    className="text-accent hover:text-accent-hover"
                  >
                    {t('users.list.approveButton')}
                  </Button>
                )}
                <Link to={ROUTES.deleteUser(user.id)} title={t('users.list.deleteButton', { defaultValue: 'Delete' })}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <ion-icon name="trash-outline" style={{ fontSize: '1.1rem' }} />
                  </Button>
                </Link>
                {user.status ? (
                  <Link to={ROUTES.blockUser(user.id)} title={t('users.list.blockButton', { defaultValue: 'Block' })}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                    >
                      <ion-icon name="lock-open-outline" style={{ fontSize: '1.1rem' }} />
                    </Button>
                  </Link>
                ) : (
                  <Link to={ROUTES.unblockUser(user.id)} title={t('users.list.unblockButton', { defaultValue: 'Unblock' })}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-txt/70 hover:bg-white/10 hover:text-txt"
                    >
                      <ion-icon name="lock-closed-outline" style={{ fontSize: '1.1rem' }} />
                    </Button>
                  </Link>
                )}
              </div>
            </td>
          </tr>
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
