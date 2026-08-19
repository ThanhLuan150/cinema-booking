import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useDeleteUser } from '../hooks/useDeleteUser';
import { ROUTES } from '@/constants/routes';

const AdminUsersDelete = () => {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const deleteUserMutation = useDeleteUser();

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteUserMutation.mutateAsync(id);
      toast.success(t('users.delete.toastSuccess'));
      navigate(ROUTES.adminUsers, { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleCancelDelete = () => {
    navigate(ROUTES.adminUsers, { replace: true });
  };

  return (
    <ConfirmDialog
      open
      title={t('users.delete.confirmTitle')}
      message={t('users.delete.confirmMessage')}
      confirmLabel={t('users.delete.confirmLabel')}
      onConfirm={handleDelete}
      onCancel={handleCancelDelete}
    />
  );
};

export default AdminUsersDelete;
