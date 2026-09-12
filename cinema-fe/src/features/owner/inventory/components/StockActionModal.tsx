import { useCallback } from 'react';
import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAdjustInventory, useDeductInventory, useReceiveInventory } from '../../hooks/useInventoryMutations';
import type { StockActionFormValues, StockActionMode } from '../../types/owner.types';
import { STOCK_ACTION_TITLE_KEY } from '../constants';

interface StockActionModalProps {
  itemId: number;
  mode: StockActionMode;
  onClose: () => void;
}

export function StockActionModal({ itemId, mode, onClose }: StockActionModalProps) {
  const { t } = useTranslation('owner');
  const receiveMutation = useReceiveInventory();
  const adjustMutation = useAdjustInventory();
  const deductMutation = useDeductInventory();

  const validateStockAction = useCallback(
    (values: StockActionFormValues) => {
      const errors: Partial<Record<keyof StockActionFormValues, string>> = {};
      const quantity = values.quantity === '' ? NaN : Number(values.quantity);
      if (mode === 'adjust') {
        if (values.quantity === '' || Number.isNaN(quantity) || quantity < 0) {
          errors.quantity = t('inventory.validation.adjustQuantityRequired');
        }
      } else if (values.quantity === '' || Number.isNaN(quantity) || quantity <= 0) {
        errors.quantity = t('inventory.validation.stockQuantityRequired');
      }
      return errors;
    },
    [mode, t],
  );

  const handleStockActionSubmit = useCallback(
    async (values: StockActionFormValues) => {
      const quantity = Number(values.quantity);
      const reason = values.reason.trim() || undefined;
      try {
        if (mode === 'receive') await receiveMutation.mutateAsync({ id: itemId, quantity, reason });
        else if (mode === 'adjust') await adjustMutation.mutateAsync({ id: itemId, quantity, reason });
        else await deductMutation.mutateAsync({ id: itemId, quantity, reason });
        toast.success(t(`inventory.stockAction.${mode}Success`));
        onClose();
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [mode, itemId, receiveMutation, adjustMutation, deductMutation, onClose, t],
  );

  const stockActionPending =
    mode === 'receive' ? receiveMutation.isPending : mode === 'adjust' ? adjustMutation.isPending : deductMutation.isPending;

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
              <Field as={Input} label={t('inventory.stockAction.reasonLabel')} name="reason" className="mt-3" />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={stockActionPending}>
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
