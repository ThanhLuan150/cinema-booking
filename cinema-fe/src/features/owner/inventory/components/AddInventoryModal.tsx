import { useCallback } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch } from '@/hooks/redux';
import { useCreateInventory } from '../../hooks/useInventoryMutations';
import { closeAddModal } from '../../store/ownerInventorySlice';
import type { InventoryFormValues } from '../../types/owner.types';
import { emptyInventoryForm } from '../constants';
import { validateInventoryDetails } from '../validateInventory';
import { InventoryDetailFields } from './InventoryDetailFields';

interface AddInventoryModalProps {
  cinemas: { id: number; name: string }[];
  onClose: () => void;
}

export function AddInventoryModal({ cinemas, onClose }: AddInventoryModalProps) {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const createMutation = useCreateInventory();

  const validateInventory = useCallback(
    (values: InventoryFormValues) => {
      const errors: Partial<Record<keyof InventoryFormValues, string>> = validateInventoryDetails(values, t);
      if (!values.cinema_id) errors.cinema_id = t('inventory.validation.cinemaRequired');
      if (values.quantity !== '' && !(Number.isFinite(Number(values.quantity)) && Number(values.quantity) >= 0)) {
        errors.quantity = t('inventory.validation.quantityInvalid');
      }
      return errors;
    },
    [t],
  );

  const handleSubmit = useCallback(
    async (values: InventoryFormValues, { resetForm }: FormikHelpers<InventoryFormValues>) => {
      try {
        await createMutation.mutateAsync(values);
        toast.success(t('inventory.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createMutation, dispatch, t],
  );

  return (
    <Modal open onClose={onClose} title={t('inventory.addTitle')}>
      <Formik<InventoryFormValues> initialValues={emptyInventoryForm()} validate={validateInventory} onSubmit={handleSubmit}>
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Select}
                label={t('inventory.cinemaLabel')}
                name="cinema_id"
                options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                placeholder={t('inventory.cinemaPlaceholder')}
                error={showErrors ? formik.errors.cinema_id : undefined}
              />
              <InventoryDetailFields cinemaId={formik.values.cinema_id} />
              <Field
                as={Input}
                label={t('inventory.quantityLabel')}
                name="quantity"
                type="number"
                className="mt-3"
                error={showErrors ? formik.errors.quantity : undefined}
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={createMutation.isPending}>
                  {t('inventory.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
