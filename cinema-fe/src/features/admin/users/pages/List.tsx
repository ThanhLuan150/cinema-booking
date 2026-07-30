import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAdminUsers } from '../hooks/useAdminUsers';
import { useUpdateUserRole } from '../hooks/useUpdateUserRole';
import { useApproveUser } from '../hooks/useApproveUser';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { Select } from 'components/ui/Select';

const ROLE_KEY: Record<number, string> = { [ROLES.admin]: 'admin', [ROLES.customer]: 'user', [ROLES.owner]: 'theater' };

const List = () => {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const { data } = useAdminUsers(page, DEFAULT_PAGE_SIZE);
  const users = data?.data ?? [];
  const updateUserRoleMutation = useUpdateUserRole();
  const approveUserMutation = useApproveUser();

  const handleRoleChange = useCallback(
    async (userId: number, role: string) => {
      try {
        await updateUserRoleMutation.mutateAsync({ userId, role: Number(role) });
        toast.success(t('users.list.roleChangeSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [updateUserRoleMutation, t],
  );

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

  const roleOptions = useMemo(
    () => Object.entries(ROLE_KEY).map(([value, key]) => ({ value, label: t(`users.list.roles.${key}`) })),
    [t],
  );

  return (
    <AdminLayout breadcrumb={t('users.list.breadcrumb')}>
      <DataTable headers={t('users.list.headers', { returnObjects: true }) as unknown as string[]}>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.id}</td>
            <td>{user.name}</td>
            <td>{user.phone}</td>
            <td>{user.email}</td>
            <td>
              <Select
                value={user.role}
                options={roleOptions}
                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                className="border-white/20 bg-transparent text-white"
              />
            </td>
            <td>
              {user.status ? t('users.list.statusActive') : <span className="text-gray-400">{t('users.list.statusInactive')}</span>}
              {user.role === ROLES.owner && !user.approved && (
                <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                  {t('users.list.pendingApproval')}
                </span>
              )}
            </td>
            <td>
              {user.role === ROLES.owner && !user.approved && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={approveUserMutation.isPending}
                  onClick={() => handleApprove(user.id)}
                  className="text-accent"
                >
                  {t('users.list.approveButton')}
                </Button>
              )}
              <Link to={ROUTES.deleteUser(user.id)}>
                <Button type="button" variant="ghost" size="sm">
                  <ion-icon name="trash-outline" style={{ color: '#E00813', fontSize: '1.4rem', marginLeft: '1rem' }} />
                </Button>
              </Link>
              {user.status ? (
                <Link to={ROUTES.blockUser(user.id)}>
                  <Button type="button" variant="ghost" size="sm">
                    <ion-icon name="lock-open-outline" style={{ color: '#E00813', fontSize: '1.4rem', marginLeft: '1rem' }} />
                  </Button>
                </Link>
              ) : (
                <Link to={ROUTES.unblockUser(user.id)}>
                  <Button type="button" variant="ghost" size="sm">
                    <ion-icon name="lock-close-outline" style={{ fontSize: '1.4rem', marginLeft: '1rem' }} />
                  </Button>
                </Link>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
};

export default List;
