import { useCallback, useEffect, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useMyEmployees } from '../../hooks/useMyEmployees';
import { useShifts } from '../../hooks/useShifts';
import { useShiftAssignments } from '../../hooks/useShiftAssignments';
import {
  useCancelShiftAssignment,
  useCreateShiftAssignment,
  useDeleteShiftAssignment,
} from '../../hooks/useShiftAssignmentMutations';
import { closeAssignModal, openAssignModal, setSelectedbranchId } from '../../store/ownerShiftsSlice';
import type { ShiftAssignmentFormValues } from '../../types/owner.types';

const emptyForm = (): ShiftAssignmentFormValues => ({ employee_id: '', shift_id: '', date: '' });

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function ShiftAssignmentList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { hasPermission } = usePermissions();
  const { selectedbranchId, showAssignModal } = useAppSelector((state) => state.ownerShifts);

  useEffect(() => {
    if (!selectedbranchId && cinemas.length > 0) {
      dispatch(setSelectedbranchId(String(cinemas[0].id)));
    }
  }, [cinemas, selectedbranchId, dispatch]);

  const { data: employeesPage } = useMyEmployees(selectedbranchId || undefined, 1, FULL_LIST_FETCH_LIMIT);
  const employees = useMemo(() => employeesPage?.data ?? [], [employeesPage]);
  const { data: shiftsPage } = useShifts(selectedbranchId || undefined, 1, FULL_LIST_FETCH_LIMIT);
  const shifts = useMemo(() => shiftsPage?.data ?? [], [shiftsPage]);
  const activeShifts = useMemo(() => shifts.filter((shift) => shift.status === 'ACTIVE'), [shifts]);

  const filters = useMemo(
    () => ({
      employeeId: employeeFilter || undefined,
      date: dateFilter || undefined,
      status: statusFilter || undefined,
    }),
    [employeeFilter, dateFilter, statusFilter],
  );

  const { data } = useShiftAssignments(selectedbranchId || undefined, filters, page, DEFAULT_PAGE_SIZE);
  const assignments = data?.data ?? [];

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const shiftById = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);

  const createAssignmentMutation = useCreateShiftAssignment();
  const cancelAssignmentMutation = useCancelShiftAssignment();
  const deleteAssignmentMutation = useDeleteShiftAssignment();

  const handleCreate = useCallback(
    async (values: ShiftAssignmentFormValues, { resetForm }: FormikHelpers<ShiftAssignmentFormValues>) => {
      try {
        await createAssignmentMutation.mutateAsync(values);
        toast.success(t('shiftAssignments.createSuccess'));
        resetForm();
        dispatch(closeAssignModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createAssignmentMutation, dispatch, t],
  );

  const handleCancel = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('shiftAssignments.cancelConfirm')))) return;
      try {
        await cancelAssignmentMutation.mutateAsync(id);
        toast.success(t('shiftAssignments.cancelSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [cancelAssignmentMutation, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('shiftAssignments.deleteConfirm')))) return;
      try {
        await deleteAssignmentMutation.mutateAsync(id);
        toast.success(t('shiftAssignments.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteAssignmentMutation, t],
  );

  const validateAssignment = useCallback(
    (values: ShiftAssignmentFormValues) => {
      const errors: Partial<Record<keyof ShiftAssignmentFormValues, string>> = {};
      if (!values.employee_id) errors.employee_id = t('shiftAssignments.validation.employeeRequired');
      if (!values.shift_id) errors.shift_id = t('shiftAssignments.validation.shiftRequired');
      if (!values.date) errors.date = t('shiftAssignments.validation.dateRequired');
      return errors;
    },
    [t],
  );

  return (
    <AdminLayout breadcrumb={t('shiftAssignments.breadcrumb')}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedbranchId}
            onChange={(e) => dispatch(setSelectedbranchId(e.target.value))}
            placeholder={t('shiftAssignments.branchPlaceholder')}
            options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
          />
        </div>
        {hasPermission('shiftAssignment.create') && (
          <Button type="button" variant="danger" onClick={() => dispatch(openAssignModal())}>
            {t('shiftAssignments.assignButton')}
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Select
            label={t('shiftAssignments.filters.employeeLabel')}
            value={employeeFilter}
            onChange={(e) => {
              setEmployeeFilter(e.target.value);
              setPage(1);
            }}
            placeholder={t('shiftAssignments.filters.allEmployees')}
            options={employees.map((employee) => ({ label: employee.name || employee.employee_code, value: employee.id }))}
          />
        </div>
        <div className="w-48">
          <DateInput
            id="dateFilter"
            label={t('shiftAssignments.filters.dateLabel')}
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-40">
          <Select
            label={t('shiftAssignments.filters.statusLabel')}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            placeholder={t('shiftAssignments.filters.allStatuses')}
            options={[
              { label: t('shiftAssignments.statusActive'), value: 'ACTIVE' },
              { label: t('shiftAssignments.statusCancelled'), value: 'CANCELLED' },
            ]}
          />
        </div>
      </div>

      {showAssignModal && (
        <Modal open onClose={() => dispatch(closeAssignModal())} title={t('shiftAssignments.assignTitle')}>
          <Formik<ShiftAssignmentFormValues> initialValues={emptyForm()} validate={validateAssignment} onSubmit={handleCreate}>
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
                    <Button type="submit" variant="danger" loading={createAssignmentMutation.isPending}>
                      {t('shiftAssignments.submit')}
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
            t('shiftAssignments.headers.id'),
            t('shiftAssignments.headers.employee'),
            t('shiftAssignments.headers.shift'),
            t('shiftAssignments.headers.date'),
            t('shiftAssignments.headers.time'),
            t('shiftAssignments.headers.status'),
            t('shiftAssignments.headers.actions'),
          ]}
        >
          {assignments.map((assignment) => {
            const employee = employeeById.get(assignment.employee_id);
            const shift = shiftById.get(assignment.shift_id);
            return (
              <tr key={assignment.id}>
                <td>{assignment.id}</td>
                <td>{employee?.name || employee?.employee_code || assignment.employee_id}</td>
                <td>{shift?.name || assignment.shift_id}</td>
                <td>{assignment.date}</td>
                <td>
                  {formatTime(assignment.start_at)} - {formatTime(assignment.end_at)}
                </td>
                <td>
                  <Badge variant={assignment.status === 'ACTIVE' ? 'success' : 'default'}>
                    {assignment.status === 'ACTIVE'
                      ? t('shiftAssignments.statusActive')
                      : t('shiftAssignments.statusCancelled')}
                  </Badge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-3">
                    {assignment.status === 'ACTIVE' && hasPermission('shiftAssignment.update') && (
                      <button
                        type="button"
                        className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
                        onClick={() => handleCancel(assignment.id)}
                      >
                        {t('shiftAssignments.cancel')}
                      </button>
                    )}
                    {hasPermission('shiftAssignment.delete') && (
                      <button
                        type="button"
                        className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                        onClick={() => handleDelete(assignment.id)}
                      >
                        {t('shiftAssignments.delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default ShiftAssignmentList;
