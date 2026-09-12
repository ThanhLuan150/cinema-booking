import { useTranslation } from 'react-i18next';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useDeleteActor } from '../hooks/useActorMutations';

interface DeleteProps {
  id: number;
}

const Delete = ({ id }: DeleteProps) => {
  const { t } = useTranslation('admin');
  const deleteActorMutation = useDeleteActor();

  const handleDelete = async () => {
    if (!(await confirmDialog(t('actors.deleteConfirm')))) return;
    try {
      await deleteActorMutation.mutateAsync(id);
      toast.success(t('actors.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <button
      type="button"
      className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
      onClick={handleDelete}
    >
      {t('actors.delete')}
    </button>
  );
};
export default Delete;
