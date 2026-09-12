import { useCallback } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { DISCOUNT_TYPE } from '@/constants/discountType';
import type { Cinema, Combo } from '@/types/entities';
import type { VoucherFormValues } from '../../types/owner.types';
import { FREE_TYPES, emptyVoucherForm } from '../constants';

interface VoucherFormModalProps {
  cinemas: Cinema[];
  combos: Combo[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: VoucherFormValues, helpers: FormikHelpers<VoucherFormValues>) => Promise<void>;
}

export function VoucherFormModal({ cinemas, combos, isSubmitting, onClose, onSubmit }: VoucherFormModalProps) {
  const { t } = useTranslation('owner');

  const validateVoucher = useCallback(
    (values: VoucherFormValues) => {
      const errors: Partial<Record<keyof VoucherFormValues, string>> = {};
      if (!values.cinema_id) errors.cinema_id = t('vouchers.validation.cinemaRequired');
      if (!values.code) errors.code = t('vouchers.validation.codeRequired');

      const isFreeType = FREE_TYPES.includes(values.discount_type);
      if (isFreeType) {
        if (values.free_quantity === '' || Number(values.free_quantity) < 1) {
          errors.free_quantity = t('vouchers.validation.freeQuantityInvalid');
        }
      } else if (values.discount_value === '') {
        errors.discount_value = t('vouchers.validation.discountValueRequired');
      } else {
        const discountValue = Number(values.discount_value);
        const isValid =
          values.discount_type === DISCOUNT_TYPE.PERCENTAGE ? discountValue >= 1 && discountValue <= 100 : discountValue > 0;
        if (!isValid) errors.discount_value = t('vouchers.validation.discountValueInvalid');
      }

      if (values.min_order_value === '') {
        errors.min_order_value = t('vouchers.validation.minOrderValueRequired');
      } else if (Number(values.min_order_value) < 0) {
        errors.min_order_value = t('vouchers.validation.minOrderValueInvalid');
      }
      return errors;
    },
    [t],
  );

  return (
    <Modal open onClose={onClose} title={t('vouchers.addTitle')}>
      <Formik<VoucherFormValues> initialValues={emptyVoucherForm()} validate={validateVoucher} onSubmit={onSubmit}>
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          const isFreeType = FREE_TYPES.includes(formik.values.discount_type);
          return (
            <Form>
              <Field
                as={Select}
                label={t('vouchers.cinemaLabel')}
                name="cinema_id"
                options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                placeholder={t('vouchers.cinemaPlaceholder')}
                error={showErrors ? formik.errors.cinema_id : undefined}
              />
              <Field
                as={Input}
                label={t('vouchers.codeLabel')}
                name="code"
                className="mt-3"
                error={showErrors ? formik.errors.code : undefined}
              />
              <Field
                as={Select}
                label={t('vouchers.discountTypeLabel')}
                name="discount_type"
                options={[
                  { label: t('vouchers.discountTypePercent'), value: DISCOUNT_TYPE.PERCENTAGE },
                  { label: t('vouchers.discountTypeFixed'), value: DISCOUNT_TYPE.FIXED_AMOUNT },
                  { label: t('vouchers.discountTypeFreeTicket'), value: DISCOUNT_TYPE.FREE_TICKET },
                  { label: t('vouchers.discountTypeFreeCombo'), value: DISCOUNT_TYPE.FREE_COMBO },
                ]}
                className="mt-3"
              />
              {!isFreeType && (
                <Field
                  as={Input}
                  label={t('vouchers.discountValueLabel')}
                  name="discount_value"
                  type="number"
                  className="mt-3"
                  error={showErrors ? formik.errors.discount_value : undefined}
                />
              )}
              {isFreeType && (
                <Field
                  as={Input}
                  label={t('vouchers.freeQuantityLabel')}
                  name="free_quantity"
                  type="number"
                  min={1}
                  className="mt-3"
                  error={showErrors ? formik.errors.free_quantity : undefined}
                />
              )}
              {formik.values.discount_type === DISCOUNT_TYPE.FREE_COMBO && (
                <Field
                  as={Select}
                  label={t('vouchers.comboLabel')}
                  name="combo_id"
                  className="mt-3"
                  options={combos.map((c) => ({ label: c.name, value: c.id }))}
                  placeholder={t('vouchers.anyCombo')}
                />
              )}
              <Field
                as={Input}
                label={t('vouchers.minOrderValueLabel')}
                name="min_order_value"
                type="number"
                className="mt-3"
                error={showErrors ? formik.errors.min_order_value : undefined}
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={isSubmitting}>
                  {t('vouchers.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
