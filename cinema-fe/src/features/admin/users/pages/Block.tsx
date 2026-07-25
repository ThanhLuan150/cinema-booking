import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAdminUserById } from '../hooks/useAdminUserById';
import { useBlockUser } from '../hooks/useBlockUser';
import { ROUTES } from '@/constants/routes';

const BlockUser = () => {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: user } = useAdminUserById(id);
  const blockUserMutation = useBlockUser();

  const handleBlock = async () => {
    if (!id) return;
    try {
      await blockUserMutation.mutateAsync(id);
      Swal.fire(t('users.block.swalTitle'), t('users.block.swalText'));
      navigate(ROUTES.adminUsers, { replace: true });
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const handleCancelBlock = () => {
    navigate(ROUTES.adminUsers, { replace: true });
  };

  return (
    <ConfirmDialog
      open
      title={t('users.block.confirmTitle')}
      message={t('users.block.confirmMessage', { name: user ? user.name : '' })}
      confirmLabel={t('users.block.confirmLabel')}
      onConfirm={handleBlock}
      onCancel={handleCancelBlock}
    />
  );
};

export default BlockUser;
