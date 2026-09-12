import { useTranslation } from 'react-i18next';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useDeleteInventory } from '../../hooks/useInventoryMutations';

export function DeleteInventoryButton({ id }: { id: number }) {
  const { t } = useTranslation('owner');
  const deleteMutation = useDeleteInventory();

  const handleDelete = async () => {
    if (!(await confirmDialog(t('inventory.deleteConfirm')))) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('inventory.deleteSuccess'));
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
      {t('inventory.delete')}
    </button>
  );
}
