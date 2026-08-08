import { useCallback, useEffect, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useMyEmployees } from '../../hooks/useMyEmployees';
import { useCreateEmployee, useDeactivateEmployee, useUpdateEmployee } from '../../hooks/useEmployeeMutations';
import { closeAddModal, openAddModal, setSelectedCinemaId } from '../../store/ownerEmployeesSlice';
import type { EmployeeFormValues } from '../../types/owner.types';

const emptyForm = (cinemaId: string): EmployeeFormValues => ({
  cinema_id: cinemaId,
  email: '',
  password: '',
  name: '',
  phone: '',
  position: '',
});

function EmployeeList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const selectedCinemaId = useAppSelector((state) => state.ownerEmployees.selectedCinemaId);
  const { showAddModal } = useAppSelector((state) => state.ownerEmployees);

  useEffect(() => {
    if (!selectedCinemaId && cinemas.length > 0) {
      dispatch(setSelectedCinemaId(String(cinemas[0].id)));
    }
  }, [cinemas, selectedCinemaId, dispatch]);

  const { data } = useMyEmployees(selectedCinemaId || undefined, page, DEFAULT_PAGE_SIZE);
  const employees = data?.data ?? [];
  const createEmployeeMutation = useCreateEmployee();
  const updateEmployeeMutation = useUpdateEmployee();
  const deactivateEmployeeMutation = useDeactivateEmployee();

  const handleReactivate = useCallback(
    async (id: number) => {
      try {
        await updateEmployeeMutation.mutateAsync({ id, status: 1 });
        toast.success(t('employees.reactivateSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [updateEmployeeMutation, t],
  );

  const handleDeactivate = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('employees.deactivateConfirm')))) return;
      try {
        await deactivateEmployeeMutation.mutateAsync(id);
        toast.success(t('employees.deactivateSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deactivateEmployeeMutation, t],
  );

  const handleSubmit = useCallback(
    async (values: EmployeeFormValues, { resetForm }: FormikHelpers<EmployeeFormValues>) => {
      try {
        await createEmployeeMutation.mutateAsync(values);
        toast.success(t('employees.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createEmployeeMutation, dispatch, t],
  );

  const validateEmployee = useCallback(
    (values: EmployeeFormValues) => {
      const errors: Partial<Record<keyof EmployeeFormValues, string>> = {};
      if (!values.cinema_id) errors.cinema_id = t('employees.validation.cinemaRequired');
      if (!values.email) errors.email = t('employees.validation.emailRequired');
      if (!values.password || values.password.length < 6) errors.password = t('employees.validation.passwordInvalid');
      return errors;
    },
    [t],
  );

  return (
    <AdminLayout breadcrumb={t('employees.breadcrumb')}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedCinemaId}
            onChange={(e) => dispatch(setSelectedCinemaId(e.target.value))}
            placeholder={t('employees.cinemaPlaceholder')}
            options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
          />
        </div>
        <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
          {t('employees.addButton')}
        </Button>
      </div>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('employees.addTitle')}>
          <Formik<EmployeeFormValues>
            initialValues={emptyForm(selectedCinemaId)}
            enableReinitialize
            validate={validateEmployee}
            onSubmit={handleSubmit}
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
                  <Field as={Input} label={t('employees.positionLabel')} name="position" className="mt-3" />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={createEmployeeMutation.isPending}>
                      {t('employees.submit')}
                    </Button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('employees.headers.id'),
            t('employees.headers.name'),
            t('employees.headers.email'),
            t('employees.headers.position'),
            t('employees.headers.status'),
            t('employees.headers.actions'),
          ]}
        >
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>{employee.id}</td>
              <td>{employee.name}</td>
              <td>{employee.email}</td>
              <td>{employee.position}</td>
              <td>
                <Badge variant={employee.status === 1 ? 'success' : 'default'}>
                  {employee.status === 1 ? t('employees.statusActive') : t('employees.statusInactive')}
                </Badge>
              </td>
              <td>
                {employee.status === 1 ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                    onClick={() => handleDeactivate(employee.id)}
                  >
                    {t('employees.deactivate')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleReactivate(employee.id)}
                  >
                    {t('employees.reactivate')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default EmployeeList;
