import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
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
      Swal.fire(t('users.delete.swalTitle'), t('users.delete.swalText'));
      navigate(ROUTES.adminUsers, { replace: true });
    } catch (error) {
      console.error('Error deleting user:', error);
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
