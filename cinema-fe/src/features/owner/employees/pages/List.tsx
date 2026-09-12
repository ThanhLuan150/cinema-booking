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
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useMyEmployees } from '../../hooks/useMyEmployees';
import { usePositions } from '../../hooks/usePositions';
import {
  useCreateEmployee,
  useDeactivateEmployee,
  useResetEmployeePassword,
  useUpdateEmployee,
} from '../../hooks/useEmployeeMutations';
import { closeAddModal, openAddModal, setSelectedbranchId } from '../../store/ownerEmployeesSlice';
import type { EmployeeFormValues } from '../../types/owner.types';
import { ALL_BRANCHES } from '../constants';
import { AddEmployeeModal } from '../components/AddEmployeeModal';
import { EmployeeTable } from '../components/EmployeeTable';

function EmployeeList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const isAdmin = useAuthRole() === ROLES.admin;
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data: positions } = usePositions();
  const { hasPermission } = usePermissions();
  const selectedbranchId = useAppSelector((state) => state.ownerEmployees.selectedbranchId);
  const { showAddModal } = useAppSelector((state) => state.ownerEmployees);
  const isAllBranches = selectedbranchId === ALL_BRANCHES;

  useEffect(() => {
    if (selectedbranchId) return;
    if (isAdmin) {
      dispatch(setSelectedbranchId(ALL_BRANCHES));
    } else if (cinemas.length > 0) {
      dispatch(setSelectedbranchId(String(cinemas[0].id)));
    }
  }, [cinemas, selectedbranchId, isAdmin, dispatch]);

  const { data, isLoading } = useMyEmployees(isAllBranches ? undefined : selectedbranchId || undefined, page, DEFAULT_PAGE_SIZE, {
    enabled: Boolean(selectedbranchId),
  });
  const employees = data?.data ?? [];
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);
  const createEmployeeMutation = useCreateEmployee();
  const updateEmployeeMutation = useUpdateEmployee();
  const deactivateEmployeeMutation = useDeactivateEmployee();
  const resetPasswordMutation = useResetEmployeePassword();

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

  const handleResetPassword = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('employees.resetPasswordConfirm')))) return;
      try {
        await resetPasswordMutation.mutateAsync(id);
        toast.success(t('employees.resetPasswordSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [resetPasswordMutation, t],
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

  return (
    <AdminLayout breadcrumb={t('employees.breadcrumb')} loading={isLoading}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedbranchId}
            onChange={(e) => dispatch(setSelectedbranchId(e.target.value))}
            placeholder={t('employees.cinemaPlaceholder')}
            options={[
              ...(isAdmin ? [{ label: t('employees.allBranches'), value: ALL_BRANCHES }] : []),
              ...cinemas.map((c) => ({ label: c.name, value: c.id })),
            ]}
          />
        </div>
        {hasPermission('employee.create') && (
          <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
            {t('employees.addButton')}
          </Button>
        )}
      </div>

      {showAddModal && (
        <AddEmployeeModal
          cinemas={cinemas}
          positions={positions ?? []}
          branchId={selectedbranchId}
          isSubmitting={createEmployeeMutation.isPending}
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleSubmit}
        />
      )}

      <EmployeeTable
        employees={employees}
        isAllBranches={isAllBranches}
        branchNameById={branchNameById}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        canUpdate={hasPermission('employee.update')}
        canDelete={hasPermission('employee.delete')}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        onResetPassword={handleResetPassword}
      />
    </AdminLayout>
  );
}

export default EmployeeList;
