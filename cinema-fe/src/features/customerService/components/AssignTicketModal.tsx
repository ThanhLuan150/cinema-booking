import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { Employee } from '@/types/entities';

export function AssignTicketModal({
  employees,
  onClose,
  onSubmit,
  submitPending,
}: {
  employees: Employee[];
  onClose: () => void;
  onSubmit: (values: { employee_id: string }) => void | Promise<void>;
  submitPending: boolean;
}) {
  const { t } = useTranslation('customerService');
  return (
    <Modal open onClose={onClose} title={t('assignTitle')}>
      <Formik initialValues={{ employee_id: '' }} onSubmit={onSubmit}>
        {(formik) => (
          <Form>
            <Field
              as={Select}
              label={t('employeeLabel')}
              name="employee_id"
              options={employees.map((e) => ({ label: e.name || e.email || `#${e.id}`, value: e.id }))}
              placeholder={t('employeePlaceholder')}
            />
            <div className="mt-6 flex justify-end">
              <Button type="submit" variant="danger" loading={submitPending} disabled={!formik.values.employee_id}>
                {t('submit')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
