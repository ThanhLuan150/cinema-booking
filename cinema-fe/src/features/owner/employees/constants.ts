import type { TFunction } from 'i18next';
import type { EmployeeFormValues } from '../types/owner.types';

export const ALL_BRANCHES = 'ALL';

export const emptyEmployeeForm = (branchId: string): EmployeeFormValues => ({
  cinema_id: branchId === ALL_BRANCHES ? '' : branchId,
  email: '',
  password: '',
  name: '',
  phone: '',
  position_id: '',
});

export const validateEmployeeForm = (values: EmployeeFormValues, t: TFunction) => {
  const errors: Partial<Record<keyof EmployeeFormValues, string>> = {};
  if (!values.cinema_id) errors.cinema_id = t('employees.validation.cinemaRequired');
  if (!values.email) errors.email = t('employees.validation.emailRequired');
  if (!values.password || values.password.length < 6) errors.password = t('employees.validation.passwordInvalid');
  if (!values.position_id) errors.position_id = t('employees.validation.positionRequired');
  return errors;
};
