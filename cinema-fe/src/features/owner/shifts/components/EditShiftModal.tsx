import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Shift } from '@/types/entities';
import type { ShiftFormValues } from '../../types/owner.types';
import { editShiftFormValues, validateShiftForm } from '../constants';

interface EditShiftModalProps {
  shift: Shift;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ShiftFormValues) => Promise<void>;
}

export function EditShiftModal({ shift, isSubmitting, onClose, onSubmit }: EditShiftModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('shifts.editTitle')}>
      <Formik<ShiftFormValues>
        initialValues={editShiftFormValues(shift)}
        validate={(values) => validateShiftForm(values, t)}
        onSubmit={onSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Input}
                label={t('shifts.nameLabel')}
                name="name"
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
                  {t('shifts.saveButton')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
