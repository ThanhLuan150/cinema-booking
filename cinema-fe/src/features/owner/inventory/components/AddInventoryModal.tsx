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
import { ComboLinkField } from './ComboLinkField';

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
      const errors: Partial<Record<keyof InventoryFormValues, string>> = {};
      if (!values.cinema_id) errors.cinema_id = t('inventory.validation.cinemaRequired');
      if (!values.item.trim()) errors.item = t('inventory.validation.itemRequired');
      if (!values.unit.trim()) errors.unit = t('inventory.validation.unitRequired');
      if (values.quantity !== '' && Number(values.quantity) < 0) {
        errors.quantity = t('inventory.validation.quantityInvalid');
      }
      if (values.minimum_quantity !== '' && Number(values.minimum_quantity) < 0) {
        errors.minimum_quantity = t('inventory.validation.minQuantityInvalid');
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
              <Field
                as={Input}
                label={t('inventory.itemLabel')}
                name="item"
                className="mt-3"
                error={showErrors ? formik.errors.item : undefined}
              />
              <Field
                as={Input}
                label={t('inventory.unitLabel')}
                name="unit"
                className="mt-3"
                error={showErrors ? formik.errors.unit : undefined}
              />
              <Field
                as={Input}
                label={t('inventory.quantityLabel')}
                name="quantity"
                type="number"
                className="mt-3"
                error={showErrors ? formik.errors.quantity : undefined}
              />
              <Field
                as={Input}
                label={t('inventory.minQuantityLabel')}
                name="minimum_quantity"
                type="number"
                className="mt-3"
                error={showErrors ? formik.errors.minimum_quantity : undefined}
              />
              <ComboLinkField
                cinemaId={formik.values.cinema_id}
                value={formik.values.combo_id}
                onChange={(value) => formik.setFieldValue('combo_id', value)}
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
