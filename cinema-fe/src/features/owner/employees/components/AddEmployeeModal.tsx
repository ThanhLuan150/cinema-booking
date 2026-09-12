import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Cinema, Position } from '@/types/entities';
import type { EmployeeFormValues } from '../../types/owner.types';
import { emptyEmployeeForm, validateEmployeeForm } from '../constants';

interface AddEmployeeModalProps {
  cinemas: Cinema[];
  positions: Position[];
  branchId: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: EmployeeFormValues, helpers: FormikHelpers<EmployeeFormValues>) => Promise<void>;
}

export function AddEmployeeModal({ cinemas, positions, branchId, isSubmitting, onClose, onSubmit }: AddEmployeeModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('employees.addTitle')}>
      <Formik<EmployeeFormValues>
        initialValues={emptyEmployeeForm(branchId)}
        enableReinitialize
        validate={(values) => validateEmployeeForm(values, t)}
        onSubmit={onSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Select}
                label={t('employees.cinemaLabel')}
                name="cinema_id"
                options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                placeholder={t('employees.cinemaPlaceholder')}
                error={showErrors ? formik.errors.cinema_id : undefined}
              />
              <Field
                as={Input}
                label={t('employees.emailLabel')}
                name="email"
                type="email"
                className="mt-3"
                error={showErrors ? formik.errors.email : undefined}
              />
              <Field
                as={Input}
                label={t('employees.passwordLabel')}
                name="password"
                type="password"
                className="mt-3"
                error={showErrors ? formik.errors.password : undefined}
              />
              <Field as={Input} label={t('employees.nameLabel')} name="name" className="mt-3" />
              <Field as={Input} label={t('employees.phoneLabel')} name="phone" className="mt-3" />
              <Field
                as={Select}
                label={t('employees.positionLabel')}
                name="position_id"
                className="mt-3"
                options={(positions ?? []).map((p) => ({ label: p.name, value: p.id }))}
                placeholder={t('employees.positionPlaceholder')}
                error={showErrors ? formik.errors.position_id : undefined}
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={isSubmitting}>
                  {t('employees.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
