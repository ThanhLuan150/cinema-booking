import type { TFunction } from 'i18next';
import type { Shift } from '@/types/entities';
import type { ShiftAssignmentFormValues, ShiftFormValues } from '../types/owner.types';

export const validateShiftForm = (values: ShiftFormValues, t: TFunction) => {
  const errors: Partial<Record<keyof ShiftFormValues, string>> = {};
  if (!values.branch_id) errors.branch_id = t('shifts.validation.branchRequired');
  if (!values.name.trim()) errors.name = t('shifts.validation.nameRequired');
  if (!values.start_time) errors.start_time = t('shifts.validation.startTimeRequired');
  if (!values.end_time) errors.end_time = t('shifts.validation.endTimeRequired');
  return errors;
};

export const emptyShiftForm = (branchId: string): ShiftFormValues => ({
  branch_id: branchId,
  name: '',
  start_time: '',
  end_time: '',
});

export const editShiftFormValues = (shift: Shift): ShiftFormValues => ({
  branch_id: String(shift.branch_id),
  name: shift.name,
  start_time: shift.start_time,
  end_time: shift.end_time,
});

export const emptyShiftAssignmentForm = (): ShiftAssignmentFormValues => ({
  employee_id: '',
  shift_id: '',
  date: '',
});

export const validateShiftAssignmentForm = (values: ShiftAssignmentFormValues, t: TFunction) => {
  const errors: Partial<Record<keyof ShiftAssignmentFormValues, string>> = {};
  if (!values.employee_id) errors.employee_id = t('shiftAssignments.validation.employeeRequired');
  if (!values.shift_id) errors.shift_id = t('shiftAssignments.validation.shiftRequired');
  if (!values.date) errors.date = t('shiftAssignments.validation.dateRequired');
  return errors;
};

export function formatAssignmentTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
