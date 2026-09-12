import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { Button } from '@/components/ui/Button';
import type { Employee, Shift } from '@/types/entities';
import type { ShiftAssignmentFormValues } from '../../types/owner.types';
import { emptyShiftAssignmentForm, validateShiftAssignmentForm } from '../constants';

interface AssignShiftModalProps {
  employees: Employee[];
  activeShifts: Shift[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ShiftAssignmentFormValues, helpers: FormikHelpers<ShiftAssignmentFormValues>) => Promise<void>;
}

export function AssignShiftModal({ employees, activeShifts, isSubmitting, onClose, onSubmit }: AssignShiftModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('shiftAssignments.assignTitle')}>
      <Formik<ShiftAssignmentFormValues>
        initialValues={emptyShiftAssignmentForm()}
        validate={(values) => validateShiftAssignmentForm(values, t)}
        onSubmit={onSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Select}
                label={t('shiftAssignments.employeeLabel')}
                name="employee_id"
                options={employees.map((employee) => ({
                  label: employee.name || employee.employee_code,
                  value: employee.id,
                }))}
                placeholder={t('shiftAssignments.employeePlaceholder')}
                error={showErrors ? formik.errors.employee_id : undefined}
              />
              <Field
                as={Select}
                label={t('shiftAssignments.shiftLabel')}
                name="shift_id"
                className="mt-3"
                options={activeShifts.map((shift) => ({
                  label: `${shift.name} (${shift.start_time}-${shift.end_time})`,
                  value: shift.id,
                }))}
                placeholder={t('shiftAssignments.shiftPlaceholder')}
                error={showErrors ? formik.errors.shift_id : undefined}
              />
              <Field
                as={DateInput}
                label={t('shiftAssignments.dateLabel')}
                name="date"
                id="date"
                className="mt-3"
                error={showErrors ? formik.errors.date : undefined}
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={isSubmitting}>
                  {t('shiftAssignments.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
