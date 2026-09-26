import { useCallback } from 'react';
import { Formik, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Inventory } from '@/types/entities';
import { useUpdateInventory } from '../../hooks/useInventoryMutations';
import type { InventoryDetailValues } from '../../types/owner.types';
import { detailsFromItem } from '../constants';
import { validateInventoryDetails } from '../validateInventory';
import { InventoryDetailFields } from './InventoryDetailFields';

interface EditInventoryModalProps {
  item: Inventory;
  onClose: () => void;
}

// Edits an item's catalogue data. Quantity is intentionally not editable here — it changes only
// through import / return / adjust / waste so every change is in the stock history.
export function EditInventoryModal({ item, onClose }: EditInventoryModalProps) {
  const { t } = useTranslation('owner');
  const updateMutation = useUpdateInventory();

  const validate = useCallback((values: InventoryDetailValues) => validateInventoryDetails(values, t), [t]);

  const handleSubmit = useCallback(
    async (values: InventoryDetailValues) => {
      try {
        await updateMutation.mutateAsync({ id: item.id, values });
        toast.success(t('inventory.updateSuccess'));
        onClose();
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [updateMutation, item.id, onClose, t],
  );

  return (
    <Modal open onClose={onClose} title={t('inventory.editTitle')}>
      <Formik<InventoryDetailValues> initialValues={detailsFromItem(item)} validate={validate} onSubmit={handleSubmit}>
        <Form>
          <p className="text-sm text-txt/60">{t('inventory.editQuantityHint', { quantity: item.quantity })}</p>
          <InventoryDetailFields cinemaId={String(item.branch_id)} />
          <div className="mt-6 flex justify-end">
            <Button type="submit" variant="danger" loading={updateMutation.isPending}>
              {t('inventory.save')}
            </Button>
          </div>
        </Form>
      </Formik>
    </Modal>
  );
}
