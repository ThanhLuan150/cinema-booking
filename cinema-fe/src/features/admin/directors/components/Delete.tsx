import { useTranslation } from 'react-i18next';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useDeleteDirector } from '../hooks/useDirectorMutations';

interface DeleteProps {
  id: number;
}

const Delete = ({ id }: DeleteProps) => {
  const { t } = useTranslation('admin');
  const deleteDirectorMutation = useDeleteDirector();

  const handleDelete = async () => {
    if (!(await confirmDialog(t('directors.deleteConfirm')))) return;
    try {
      await deleteDirectorMutation.mutateAsync(id);
      toast.success(t('directors.deleteSuccess'));
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
      {t('directors.delete')}
    </button>
  );
};
export default Delete;
