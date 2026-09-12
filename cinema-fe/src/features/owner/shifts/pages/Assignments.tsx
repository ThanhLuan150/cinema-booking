import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
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
import { AssignShiftModal } from '../components/AssignShiftModal';
import { AssignmentFiltersBar } from '../components/AssignmentFiltersBar';
import { ShiftAssignmentTable } from '../components/ShiftAssignmentTable';

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

  const { data, isLoading } = useShiftAssignments(selectedbranchId || undefined, filters, page, DEFAULT_PAGE_SIZE);
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

  return (
    <AdminLayout breadcrumb={t('shiftAssignments.breadcrumb')} loading={isLoading}>
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

      <AssignmentFiltersBar
        employees={employees}
        employeeFilter={employeeFilter}
        onEmployeeFilterChange={(value) => {
          setEmployeeFilter(value);
          setPage(1);
        }}
        dateFilter={dateFilter}
        onDateFilterChange={(value) => {
          setDateFilter(value);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />

      {showAssignModal && (
        <AssignShiftModal
          employees={employees}
          activeShifts={activeShifts}
          isSubmitting={createAssignmentMutation.isPending}
          onClose={() => dispatch(closeAssignModal())}
          onSubmit={handleCreate}
        />
      )}

      <ShiftAssignmentTable
        assignments={assignments}
        employeeById={employeeById}
        shiftById={shiftById}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        canUpdate={hasPermission('shiftAssignment.update')}
        canDelete={hasPermission('shiftAssignment.delete')}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
}

export default ShiftAssignmentList;
