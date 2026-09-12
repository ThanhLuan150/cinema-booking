import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Cinema } from '@/types/entities';
import type { ShiftFormValues } from '../../types/owner.types';
import { emptyShiftForm, validateShiftForm } from '../constants';

interface AddShiftModalProps {
  cinemas: Cinema[];
  branchId: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ShiftFormValues, helpers: FormikHelpers<ShiftFormValues>) => Promise<void>;
}

export function AddShiftModal({ cinemas, branchId, isSubmitting, onClose, onSubmit }: AddShiftModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('shifts.addTitle')}>
      <Formik<ShiftFormValues>
        initialValues={emptyShiftForm(branchId)}
        enableReinitialize
        validate={(values) => validateShiftForm(values, t)}
        onSubmit={onSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Select}
                label={t('shifts.branchLabel')}
                name="branch_id"
                options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                placeholder={t('shifts.branchPlaceholder')}
                error={showErrors ? formik.errors.branch_id : undefined}
              />
              <Field
                as={Input}
                label={t('shifts.nameLabel')}
                name="name"
                className="mt-3"
                error={showErrors ? formik.errors.name : undefined}
              />
              <Field
                as={Input}
                label={t('shifts.startTimeLabel')}
                name="start_time"
                type="time"
                className="mt-3"
                error={showErrors ? formik.errors.start_time : undefined}
              />
              <Field
                as={Input}
                label={t('shifts.endTimeLabel')}
                name="end_time"
                type="time"
                className="mt-3"
                error={showErrors ? formik.errors.end_time : undefined}
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={isSubmitting}>
                  {t('shifts.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
