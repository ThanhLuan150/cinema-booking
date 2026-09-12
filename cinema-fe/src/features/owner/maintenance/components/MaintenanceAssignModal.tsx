import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Employee } from '@/types/entities';

interface MaintenanceAssignModalProps {
  employees: Employee[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: { employee_id: string }) => void | Promise<void>;
}

export function MaintenanceAssignModal({ employees, loading, onClose, onSubmit }: MaintenanceAssignModalProps) {
  const { t } = useTranslation('owner');
  return (
    <Modal open onClose={onClose} title={t('maintenance.assignTitle')}>
      <Formik initialValues={{ employee_id: '' }} onSubmit={onSubmit}>
        {(formik) => (
          <Form>
            <Field
              as={Select}
              label={t('maintenance.employeeLabel')}
              name="employee_id"
              options={employees.map((e) => ({ label: e.name || e.email || `#${e.id}`, value: e.id }))}
              placeholder={t('maintenance.employeePlaceholder')}
            />
            <div className="mt-6 flex justify-end">
              <Button type="submit" variant="danger" loading={loading} disabled={!formik.values.employee_id}>
                {t('maintenance.submit')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
