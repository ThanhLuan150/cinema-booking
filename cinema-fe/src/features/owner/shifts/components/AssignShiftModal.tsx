import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Button } from '@/components/ui/Button';
import type { Employee, Position, Shift } from '@/types/entities';
import type { ShiftAssignmentFormValues } from '../../types/owner.types';
import { emptyShiftAssignmentForm, validateShiftAssignmentForm } from '../constants';

interface AssignShiftModalProps {
  employees: Employee[];
  activeShifts: Shift[];
  positions: Position[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ShiftAssignmentFormValues, helpers: FormikHelpers<ShiftAssignmentFormValues>) => Promise<void>;
}

export function AssignShiftModal({
  employees,
  activeShifts,
  positions,
  isSubmitting,
  onClose,
  onSubmit,
}: AssignShiftModalProps) {
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
                onChange={(event: { target: { value: string } }) => {
                  const shiftId = event.target.value;
                  formik.setFieldValue('shift_id', shiftId);
                  const shift = activeShifts.find((candidate) => String(candidate.id) === String(shiftId));
                  if (shift) {
                    formik.setFieldValue('start_time', shift.start_time);
                    formik.setFieldValue('end_time', shift.end_time);
                  }
                }}
              />
              <Field
                as={Select}
                label={t('shiftAssignments.positionLabel')}
                name="position_id"
                className="mt-3"
                options={positions
                  .filter((position) => position.status !== 0)
                  .map((position) => ({ label: position.name, value: position.id }))}
                placeholder={t('shiftAssignments.positionPlaceholder')}
              />
              <Field
                as={DateInput}
                label={t('shiftAssignments.dateLabel')}
                name="date"
                id="date"
                className="mt-3"
                error={showErrors ? formik.errors.date : undefined}
              />
              <Field
                as={Input}
                label={t('shifts.startTimeLabel')}
                name="start_time"
                id="start_time"
                type="time"
                className="mt-3"
                error={showErrors ? formik.errors.start_time : undefined}
              />
              <Field
                as={Input}
                label={t('shifts.endTimeLabel')}
                name="end_time"
                id="end_time"
                type="time"
                className="mt-3"
                error={showErrors ? formik.errors.end_time : undefined}
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
