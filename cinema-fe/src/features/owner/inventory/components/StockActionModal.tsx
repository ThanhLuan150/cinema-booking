import { useCallback } from 'react';
import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  useAdjustInventory,
  useImportInventory,
  useReturnInventory,
  useWasteInventory,
} from '../../hooks/useInventoryMutations';
import type { StockActionFormValues, StockActionMode } from '../../types/owner.types';
import { STOCK_ACTION_TITLE_KEY } from '../constants';

interface StockActionModalProps {
  itemId: number;
  mode: StockActionMode;
  onClose: () => void;
}

export function StockActionModal({ itemId, mode, onClose }: StockActionModalProps) {
  const { t } = useTranslation('owner');
  const importMutation = useImportInventory();
  const returnMutation = useReturnInventory();
  const adjustMutation = useAdjustInventory();
  const wasteMutation = useWasteInventory();
  const mutation = { import: importMutation, return: returnMutation, adjust: adjustMutation, waste: wasteMutation }[mode];

  const validateStockAction = useCallback(
    (values: StockActionFormValues) => {
      const errors: Partial<Record<keyof StockActionFormValues, string>> = {};
      const quantity = values.quantity === '' ? NaN : Number(values.quantity);
      if (mode === 'adjust') {
        if (values.quantity === '' || !Number.isFinite(quantity) || quantity < 0) {
          errors.quantity = t('inventory.validation.adjustQuantityRequired');
        }
      } else if (values.quantity === '' || !Number.isFinite(quantity) || quantity <= 0) {
        errors.quantity = t('inventory.validation.stockQuantityRequired');
      }
      return errors;
    },
    [mode, t],
  );

  const handleStockActionSubmit = useCallback(
    async (values: StockActionFormValues) => {
      try {
        await mutation.mutateAsync({
          id: itemId,
          quantity: Number(values.quantity),
          reason: values.reason.trim() || undefined,
        });
        toast.success(t(`inventory.stockAction.${mode}Success`));
        onClose();
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [mode, itemId, mutation, onClose, t],
  );

  return (
    <Modal open onClose={onClose} title={t(STOCK_ACTION_TITLE_KEY[mode])}>
      <Formik<StockActionFormValues>
        initialValues={{ quantity: '', reason: '' }}
        validate={validateStockAction}
        onSubmit={handleStockActionSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Input}
                label={t('inventory.stockAction.quantityLabel')}
                name="quantity"
                type="number"
                error={showErrors ? formik.errors.quantity : undefined}
              />
              {mode === 'adjust' && <p className="mt-1.5 text-xs text-txt/50">{t('inventory.stockAction.adjustQuantityHint')}</p>}
              <Field as={Input} label={t('inventory.stockAction.reasonLabel')} name="reason" maxLength={500} className="mt-3" />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={mutation.isPending}>
                  {t('inventory.stockAction.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
