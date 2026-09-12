import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROLES } from '@/constants/roles';
import { MAINTENANCE_RESOURCE_TYPE } from '@/constants/maintenanceResourceType';
import { MAINTENANCE_STATUS } from '@/constants/maintenanceStatus';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import type { MaintenanceRequest } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useMyEmployees } from '../../hooks/useMyEmployees';
import { useOwnerMaintenance } from '../../hooks/useOwnerMaintenance';
import {
  useAssignMaintenanceRequest,
  useCloseMaintenanceRequest,
  useCreateMaintenanceRequest,
  useDeleteMaintenanceRequest,
  useResolveMaintenanceRequest,
  useStartMaintenanceRequest,
} from '../../hooks/useMaintenanceMutations';
import {
  closeAddModal,
  closeAssignModal,
  closeResolveModal,
  openAddModal,
  openAssignModal,
  openResolveModal,
  setSelectedbranchId,
} from '../../store/ownerMaintenanceSlice';
import type { MaintenanceRequestFormValues } from '../../types/owner.types';
import { ALL_BRANCHES, ROOM_LIKE_TYPES } from '../constants';
import { MaintenanceToolbar } from '../components/MaintenanceToolbar';
import { MaintenanceCreateModal } from '../components/MaintenanceCreateModal';
import { MaintenanceAssignModal } from '../components/MaintenanceAssignModal';
import { MaintenanceResolveModal } from '../components/MaintenanceResolveModal';
import { MaintenanceTable } from '../components/MaintenanceTable';

function MaintenanceList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const isAdmin = useAuthRole() === ROLES.admin;
  const isEmployee = useAuthRole() === ROLES.employee;
  const { hasPermission } = usePermissions();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // An Employee holds no branch.read permission, so /cinema/mine 403s for them — they only ever
  // work their own single branch anyway, which /user already tells us (currentUser.cinema_id).
  const { data: currentUser } = useCurrentUser();
  const { data: cinemasPage } = useMyCinemas({ enabled: !isEmployee });
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const selectedbranchId = useAppSelector((state) => state.ownerMaintenance.selectedbranchId);
  const { showAddModal, assignRequestId, resolveRequestId } = useAppSelector((state) => state.ownerMaintenance);
  const isAllBranches = selectedbranchId === ALL_BRANCHES;

  useEffect(() => {
    if (selectedbranchId) return;
    if (isEmployee) {
      if (currentUser?.cinema_id) dispatch(setSelectedbranchId(String(currentUser.cinema_id)));
    } else if (isAdmin) {
      dispatch(setSelectedbranchId(ALL_BRANCHES));
    } else if (cinemas.length > 0) {
      dispatch(setSelectedbranchId(String(cinemas[0].id)));
    }
  }, [cinemas, selectedbranchId, isAdmin, isEmployee, currentUser, dispatch]);

  const { data, isLoading } = useOwnerMaintenance(isAllBranches ? undefined : selectedbranchId || undefined, page, DEFAULT_PAGE_SIZE, statusFilter || undefined, {
    enabled: Boolean(selectedbranchId),
  });
  const requests = useMemo(() => data?.data ?? [], [data]);

  const { data: employeesPage } = useMyEmployees(isAllBranches ? undefined : selectedbranchId || undefined, 1, FULL_LIST_FETCH_LIMIT);
  const employees = useMemo(() => (employeesPage?.data ?? []).filter((e) => e.status === 1), [employeesPage]);
  const employeeNameById = useMemo(
    () => new Map(employees.map((e) => [e.id, e.name || e.email || `#${e.id}`])),
    [employees],
  );

  const assignRequest = useMemo(() => requests.find((r) => r.id === assignRequestId) ?? null, [requests, assignRequestId]);
  const resolveRequest = useMemo(() => requests.find((r) => r.id === resolveRequestId) ?? null, [requests, resolveRequestId]);

  const createMutation = useCreateMaintenanceRequest();
  const assignMutation = useAssignMaintenanceRequest();
  const startMutation = useStartMaintenanceRequest();
  const resolveMutation = useResolveMaintenanceRequest();
  const closeMutation = useCloseMaintenanceRequest();
  const deleteMutation = useDeleteMaintenanceRequest();

  const handleCreate = useCallback(
    async (values: MaintenanceRequestFormValues, { resetForm }: FormikHelpers<MaintenanceRequestFormValues>) => {
      try {
        await createMutation.mutateAsync({
          branch_id: Number(values.branch_id),
          resource_type: values.resource_type,
          room_id: values.room_id ? Number(values.room_id) : undefined,
          seat_id: values.seat_id ? Number(values.seat_id) : undefined,
          resource_name: values.resource_name.trim() || undefined,
          title: values.title.trim(),
          description: values.description.trim(),
        });
        toast.success(t('maintenance.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createMutation, dispatch, t],
  );

  const validateRequest = useCallback(
    (values: MaintenanceRequestFormValues) => {
      const errors: Partial<Record<keyof MaintenanceRequestFormValues, string>> = {};
      if (!values.branch_id) errors.branch_id = t('maintenance.validation.branchRequired');
      if (!values.title.trim()) errors.title = t('maintenance.validation.titleRequired');
      if (values.resource_type === MAINTENANCE_RESOURCE_TYPE.ROOM && !values.room_id) {
        errors.room_id = t('maintenance.validation.roomRequired');
      }
      if (values.resource_type === MAINTENANCE_RESOURCE_TYPE.SEAT) {
        if (!values.room_id) errors.room_id = t('maintenance.validation.roomRequired');
        if (!values.seat_id) errors.seat_id = t('maintenance.validation.seatRequired');
      }
      if (!ROOM_LIKE_TYPES.includes(values.resource_type) && !values.resource_name.trim()) {
        errors.resource_name = t('maintenance.validation.resourceNameRequired');
      }
      return errors;
    },
    [t],
  );

  const closeAssign = useCallback(() => dispatch(closeAssignModal()), [dispatch]);
  const closeResolve = useCallback(() => dispatch(closeResolveModal()), [dispatch]);

  const handleAssign = useCallback(
    async (values: { employee_id: string }) => {
      if (!assignRequest) return;
      try {
        await assignMutation.mutateAsync({ id: assignRequest.id, employee_id: Number(values.employee_id) });
        toast.success(t('maintenance.assignSuccess'));
        dispatch(closeAssignModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [assignRequest, assignMutation, dispatch, t],
  );

  const handleResolve = useCallback(
    async (values: { resolution_note: string }) => {
      if (!resolveRequest) return;
      try {
        await resolveMutation.mutateAsync({ id: resolveRequest.id, resolution_note: values.resolution_note.trim() || undefined });
        toast.success(t('maintenance.resolveSuccess'));
        dispatch(closeResolveModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [resolveRequest, resolveMutation, dispatch, t],
  );

  const handleStart = useCallback(
    async (id: number) => {
      try {
        await startMutation.mutateAsync(id);
        toast.success(t('maintenance.startSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [startMutation, t],
  );

  const handleClose = useCallback(
    async (id: number) => {
      try {
        await closeMutation.mutateAsync(id);
        toast.success(t('maintenance.closeSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [closeMutation, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('maintenance.deleteConfirm')))) return;
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(t('maintenance.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteMutation, t],
  );

  const statusOptions = Object.values(MAINTENANCE_STATUS).map((status) => ({
    label: t(`maintenance.status.${status}`),
    value: status,
  }));

  const describeResource = useCallback(
    (r: MaintenanceRequest) => {
      const type = t(`maintenance.resourceType.${r.resource_type}`);
      return r.resource_name ? `${type} · ${r.resource_name}` : type;
    },
    [t],
  );

  return (
    <AdminLayout breadcrumb={t('maintenance.breadcrumb')} loading={isLoading}>
      <MaintenanceToolbar
        isEmployee={isEmployee}
        isAdmin={isAdmin}
        cinemas={cinemas}
        selectedbranchId={selectedbranchId}
        onBranchChange={(branchId) => dispatch(setSelectedbranchId(branchId))}
        statusOptions={statusOptions}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        canCreate={hasPermission('maintenance.create')}
        onAdd={() => dispatch(openAddModal())}
      />

      {showAddModal && (
        <MaintenanceCreateModal
          selectedbranchId={selectedbranchId}
          isEmployee={isEmployee}
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleCreate}
          validate={validateRequest}
        />
      )}

      {assignRequest && (
        <MaintenanceAssignModal
          employees={employees}
          loading={assignMutation.isPending}
          onClose={closeAssign}
          onSubmit={handleAssign}
        />
      )}

      {resolveRequest && (
        <MaintenanceResolveModal loading={resolveMutation.isPending} onClose={closeResolve} onSubmit={handleResolve} />
      )}

      <MaintenanceTable
        requests={requests}
        isAllBranches={isAllBranches}
        branchNameById={branchNameById}
        employeeNameById={employeeNameById}
        hasPermission={hasPermission}
        describeResource={describeResource}
        onAssign={(id) => dispatch(openAssignModal(id))}
        onStart={handleStart}
        onResolve={(id) => dispatch(openResolveModal(id))}
        onClose={handleClose}
        onDelete={handleDelete}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </AdminLayout>
  );
}

export default MaintenanceList;
