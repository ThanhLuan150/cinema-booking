import { Formik, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { PricingRuleFormValues } from '../../types/owner.types';
import type { SelectOption } from '../types/pricingRules.types';
import { PricingRuleFormFields } from './PricingRuleFormFields';

interface PricingRuleFormModalProps {
  mode: 'create' | 'edit';
  initialValues: PricingRuleFormValues;
  branchOptions: SelectOption[];
  roomTypeOptions: SelectOption[];
  seatTypeOptions: SelectOption[];
  categoryOptions: SelectOption[];
  dayTypeOptions: SelectOption[];
  membershipOptions: SelectOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: PricingRuleFormValues, helpers: FormikHelpers<PricingRuleFormValues>) => void | Promise<void>;
  validate: (values: PricingRuleFormValues) => Partial<Record<keyof PricingRuleFormValues, string>>;
}

export function PricingRuleFormModal({
  mode,
  initialValues,
  branchOptions,
  roomTypeOptions,
  seatTypeOptions,
  categoryOptions,
  dayTypeOptions,
  membershipOptions,
  saving,
  onClose,
  onSubmit,
  validate,
}: PricingRuleFormModalProps) {
  const { t } = useTranslation('owner');
  return (
    <Modal open onClose={onClose} title={mode === 'create' ? t('pricingRules.addTitle') : t('pricingRules.editTitle')}>
      <Formik<PricingRuleFormValues> initialValues={initialValues} validate={validate} onSubmit={onSubmit}>
        {(formik) => (
          <Form>
            <PricingRuleFormFields
              formik={formik}
              branchOptions={branchOptions}
              roomTypeOptions={roomTypeOptions}
              seatTypeOptions={seatTypeOptions}
              categoryOptions={categoryOptions}
              dayTypeOptions={dayTypeOptions}
              membershipOptions={membershipOptions}
            />
            <div className="mt-6 flex justify-end">
              <Button type="submit" variant="danger" loading={saving}>
                {t('pricingRules.submit')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
