import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

// Only admin/user/theater-owner are assignable via PUT /users/:id/role (backend rejects any
// other value) — an EMPLOYEE account is managed through the Branch Admin's employee module
// instead, so it gets a static label below rather than a dropdown that can never save.
const ROLE_KEY: Record<number, string> = { [ROLES.admin]: 'admin', [ROLES.customer]: 'user', [ROLES.owner]: 'theater' };
const EMPLOYEE_ROLE_LABEL_KEY = 'employee';

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
              {user.role === ROLES.employee ? (
                <Badge variant="default">{t(`users.list.roles.${EMPLOYEE_ROLE_LABEL_KEY}`)}</Badge>
              ) : (
                <Select
                  value={user.role}
                  options={roleOptions}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className="min-w-[9rem] py-2 text-sm"
                />
              )}
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
    </AdminLayout>
  );
};

export default List;
