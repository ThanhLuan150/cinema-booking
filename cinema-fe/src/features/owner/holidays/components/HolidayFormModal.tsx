import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { HolidayFormValues } from '../../types/owner.types';
import { emptyHolidayForm } from '../constants';

interface HolidayFormModalProps {
  defaultBranchId: string;
  branchOptions: { label: string; value: string }[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: HolidayFormValues, helpers: FormikHelpers<HolidayFormValues>) => Promise<void>;
}

export function HolidayFormModal({ defaultBranchId, branchOptions, isSubmitting, onClose, onSubmit }: HolidayFormModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('holidays.addTitle')}>
      <Formik<HolidayFormValues>
        initialValues={emptyHolidayForm(defaultBranchId)}
        validate={(values) => {
          const errors: Partial<Record<keyof HolidayFormValues, string>> = {};
          if (!values.date) errors.date = t('holidays.validation.dateRequired');
          return errors;
        }}
        onSubmit={onSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={DateInput}
                label={t('holidays.dateLabel')}
                id="holiday-date"
                name="date"
                error={showErrors ? formik.errors.date : undefined}
              />
              <Field as={Input} label={t('holidays.nameLabel')} name="name" className="mt-3" />
              <Field
                as={Select}
                label={t('holidays.branchLabel')}
                name="branch_id"
                className="mt-3"
                options={branchOptions}
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={isSubmitting}>
                  {t('holidays.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
