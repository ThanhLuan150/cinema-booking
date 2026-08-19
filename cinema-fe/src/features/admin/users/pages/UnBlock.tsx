import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAdminUserById } from '../hooks/useAdminUserById';
import { useUnblockUser } from '../hooks/useUnblockUser';
import { ROUTES } from '@/constants/routes';

const UnblockUser = () => {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: user } = useAdminUserById(id);
  const unblockUserMutation = useUnblockUser();

  const handleUnblock = async () => {
    if (!id) return;
    try {
      await unblockUserMutation.mutateAsync({ id, status: 1 });
      toast.success(t('users.unblock.toastSuccess'));
      navigate(ROUTES.adminUsers, { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleCancelUnblock = () => {
    navigate(ROUTES.adminUsers, { replace: true });
  };

  return (
    <ConfirmDialog
      open
      title={t('users.unblock.confirmTitle')}
      message={t('users.unblock.confirmMessage', { name: user ? user.name : '' })}
      confirmLabel={t('users.unblock.confirmLabel')}
      confirmVariant="success"
      onConfirm={handleUnblock}
      onCancel={handleCancelUnblock}
    />
  );
};

export default UnblockUser;
