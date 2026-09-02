import { useCallback, useEffect, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
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
import type { MaintenanceRequest, MaintenanceStatus } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useMyEmployees } from '../../hooks/useMyEmployees';
import { useRoomsByCinema } from '../../hooks/useRoomsByCinema';
import { useSeatsByRoom } from '../../hooks/useSeatsByRoom';
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

const ALL_BRANCHES = 'ALL';
const ROOM_LIKE_TYPES: string[] = [MAINTENANCE_RESOURCE_TYPE.ROOM, MAINTENANCE_RESOURCE_TYPE.SEAT];

const STATUS_VARIANT: Record<MaintenanceStatus, 'warning' | 'outline' | 'accent' | 'success' | 'default'> = {
  OPEN: 'warning',
  ASSIGNED: 'outline',
  IN_PROGRESS: 'accent',
  RESOLVED: 'success',
  CLOSED: 'default',
};

function emptyForm(branchId: string): MaintenanceRequestFormValues {
  return {
    branch_id: branchId === ALL_BRANCHES ? '' : branchId,
    resource_type: MAINTENANCE_RESOURCE_TYPE.ROOM,
    room_id: '',
    seat_id: '',
    resource_name: '',
    title: '',
    description: '',
  };
}

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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {!isEmployee && (
          <div className="max-w-xs flex-1">
            <Select
              value={selectedbranchId}
              onChange={(e) => dispatch(setSelectedbranchId(e.target.value))}
              placeholder={t('maintenance.branchPlaceholder')}
              options={[
                ...(isAdmin ? [{ label: t('maintenance.allBranches'), value: ALL_BRANCHES }] : []),
                ...cinemas.map((c) => ({ label: c.name, value: c.id })),
              ]}
            />
          </div>
        )}
        <div className="max-w-xs flex-1">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder={t('maintenance.statusFilterPlaceholder')}
            options={statusOptions}
          />
        </div>
        {hasPermission('maintenance.create') && (
          <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
            {t('maintenance.addButton')}
          </Button>
        )}
      </div>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('maintenance.addTitle')}>
          <Formik<MaintenanceRequestFormValues>
            initialValues={emptyForm(selectedbranchId)}
            enableReinitialize
            validate={validateRequest}
            onSubmit={handleCreate}
          >
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              const isRoom = formik.values.resource_type === MAINTENANCE_RESOURCE_TYPE.ROOM;
              const isSeat = formik.values.resource_type === MAINTENANCE_RESOURCE_TYPE.SEAT;
              return (
                <MaintenanceCreateFields
                  formik={formik}
                  showErrors={showErrors}
                  isRoom={isRoom}
                  isSeat={isSeat}
                  isEmployee={isEmployee}
                />
              );
            }}
          </Formik>
        </Modal>
      )}

      {assignRequest && (
        <Modal open onClose={closeAssign} title={t('maintenance.assignTitle')}>
          <Formik initialValues={{ employee_id: '' }} onSubmit={handleAssign}>
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
                  <Button type="submit" variant="danger" loading={assignMutation.isPending} disabled={!formik.values.employee_id}>
                    {t('maintenance.submit')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </Modal>
      )}

      {resolveRequest && (
        <Modal open onClose={closeResolve} title={t('maintenance.resolveTitle')}>
          <Formik initialValues={{ resolution_note: '' }} onSubmit={handleResolve}>
            <Form>
              <Field as={Textarea} label={t('maintenance.resolutionNoteLabel')} name="resolution_note" rows={3} />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={resolveMutation.isPending}>
                  {t('maintenance.submit')}
                </Button>
              </div>
            </Form>
          </Formik>
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('maintenance.headers.id'),
            ...(isAllBranches ? [t('maintenance.headers.branch')] : []),
            t('maintenance.headers.resource'),
            t('maintenance.headers.title'),
            t('maintenance.headers.assignee'),
            t('maintenance.headers.status'),
            t('maintenance.headers.actions'),
          ]}
        >
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              {isAllBranches && <td>{branchNameById.get(r.branch_id) || r.branch_id}</td>}
              <td>{describeResource(r)}</td>
              <td>{r.title}</td>
              <td>{r.assigned_employee_id ? employeeNameById.get(r.assigned_employee_id) || `#${r.assigned_employee_id}` : t('maintenance.unassigned')}</td>
              <td>
                <Badge variant={STATUS_VARIANT[r.status]}>{t(`maintenance.status.${r.status}`)}</Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                {(r.status === 'OPEN' || r.status === 'ASSIGNED') && hasPermission('maintenance.assign') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => dispatch(openAssignModal(r.id))}
                  >
                    {r.status === 'OPEN' ? t('maintenance.assign') : t('maintenance.reassign')}
                  </button>
                )}
                {r.status === 'ASSIGNED' && hasPermission('maintenance.update') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleStart(r.id)}
                  >
                    {t('maintenance.start')}
                  </button>
                )}
                {r.status === 'IN_PROGRESS' && hasPermission('maintenance.update') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => dispatch(openResolveModal(r.id))}
                  >
                    {t('maintenance.resolve')}
                  </button>
                )}
                {r.status === 'RESOLVED' && hasPermission('maintenance.close') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleClose(r.id)}
                  >
                    {t('maintenance.close')}
                  </button>
                )}
                {r.status === 'OPEN' && hasPermission('maintenance.delete') && (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                    onClick={() => handleDelete(r.id)}
                  >
                    {t('maintenance.delete')}
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

interface MaintenanceCreateFieldsProps {
  formik: {
    values: MaintenanceRequestFormValues;
    errors: Partial<Record<keyof MaintenanceRequestFormValues, string>>;
    isSubmitting: boolean;
    setFieldValue: (field: string, value: unknown) => void;
  };
  showErrors: boolean;
  isRoom: boolean;
  isSeat: boolean;
  isEmployee: boolean;
}

// Split out so the resource_type-dependent Room/Seat pickers can call the branch/room-scoped
// hooks conditionally without violating the rules of hooks in the parent render. `formik` is
// passed down from the parent's <Formik> render-prop, so its own onSubmit mutation (and
// isSubmitting) stays the single source of truth — this component never starts a second one.
function MaintenanceCreateFields({ formik, showErrors, isRoom, isSeat, isEmployee }: MaintenanceCreateFieldsProps) {
  const { t } = useTranslation('owner');
  // Same 403-avoidance as the parent: an Employee can't list cinemas, but their branch_id is
  // already fixed (initialValues), so the field is just hidden rather than fetched for nothing.
  const { data: cinemasPage } = useMyCinemas({ enabled: !isEmployee });
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data: roomsPage } = useRoomsByCinema(formik.values.branch_id || undefined);
  const rooms = useMemo(() => roomsPage?.data ?? [], [roomsPage]);
  const { data: seats } = useSeatsByRoom(isSeat ? formik.values.room_id || undefined : undefined);

  const resourceTypeOptions = Object.values(MAINTENANCE_RESOURCE_TYPE).map((type) => ({
    label: t(`maintenance.resourceType.${type}`),
    value: type,
  }));

  return (
    <Form>
      {!isEmployee && (
        <Field
          as={Select}
          label={t('maintenance.branchLabel')}
          name="branch_id"
          options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
          placeholder={t('maintenance.branchPlaceholder')}
          error={showErrors ? formik.errors.branch_id : undefined}
        />
      )}
      <Field
        as={Select}
        label={t('maintenance.resourceTypeLabel')}
        name="resource_type"
        className="mt-3"
        options={resourceTypeOptions}
        onChange={(e: { target: { value: string } }) => {
          formik.setFieldValue('resource_type', e.target.value);
          formik.setFieldValue('room_id', '');
          formik.setFieldValue('seat_id', '');
        }}
      />
      {(isRoom || isSeat) && (
        <Field
          as={Select}
          label={t('maintenance.roomLabel')}
          name="room_id"
          className="mt-3"
          options={rooms.map((r) => ({ label: r.name, value: r.id }))}
          placeholder={t('maintenance.roomPlaceholder')}
          error={showErrors ? formik.errors.room_id : undefined}
          onChange={(e: { target: { value: string } }) => {
            formik.setFieldValue('room_id', e.target.value);
            formik.setFieldValue('seat_id', '');
          }}
        />
      )}
      {isSeat && (
        <Field
          as={Select}
          label={t('maintenance.seatLabel')}
          name="seat_id"
          className="mt-3"
          options={(seats ?? []).map((s) => ({ label: s.seat_code, value: s.id }))}
          placeholder={t('maintenance.seatPlaceholder')}
          error={showErrors ? formik.errors.seat_id : undefined}
        />
      )}
      {!isRoom && !isSeat && (
        <>
          <Field
            as={Select}
            label={t('maintenance.roomOptionalLabel')}
            name="room_id"
            className="mt-3"
            options={rooms.map((r) => ({ label: r.name, value: r.id }))}
            placeholder={t('maintenance.roomOptionalPlaceholder')}
          />
          <Field
            as={Input}
            label={t('maintenance.resourceNameLabel')}
            name="resource_name"
            className="mt-3"
            error={showErrors ? formik.errors.resource_name : undefined}
          />
        </>
      )}
      <Field
        as={Input}
        label={t('maintenance.titleLabel')}
        name="title"
        className="mt-3"
        error={showErrors ? formik.errors.title : undefined}
      />
      <Field as={Textarea} label={t('maintenance.descriptionLabel')} name="description" className="mt-3" rows={2} />
      <div className="mt-6 flex justify-end">
        <Button type="submit" variant="danger" loading={formik.isSubmitting}>
          {t('maintenance.submit')}
        </Button>
      </div>
    </Form>
  );
}

export default MaintenanceList;
