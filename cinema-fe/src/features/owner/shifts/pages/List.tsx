import { useCallback, useEffect, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { Link } from 'react-router-dom';
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
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { ROUTES } from '@/constants/routes';
import type { Shift } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useShifts } from '../../hooks/useShifts';
import { useCreateShift, useDeleteShift, useUpdateShift } from '../../hooks/useShiftMutations';
import {
  closeAddModal,
  closeEditModal,
  openAddModal,
  openEditModal,
  setSelectedbranchId,
} from '../../store/ownerShiftsSlice';
import type { ShiftFormValues } from '../../types/owner.types';

const emptyForm = (branchId: string): ShiftFormValues => ({
  branch_id: branchId,
  name: '',
  start_time: '',
  end_time: '',
});

const editFormValues = (shift: Shift): ShiftFormValues => ({
  branch_id: String(shift.branch_id),
  name: shift.name,
  start_time: shift.start_time,
  end_time: shift.end_time,
});

function ShiftList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { hasPermission } = usePermissions();
  const { selectedbranchId, showAddModal, editingShiftId } = useAppSelector((state) => state.ownerShifts);

  useEffect(() => {
    if (!selectedbranchId && cinemas.length > 0) {
      dispatch(setSelectedbranchId(String(cinemas[0].id)));
    }
  }, [cinemas, selectedbranchId, dispatch]);

  const { data } = useShifts(selectedbranchId || undefined, page, DEFAULT_PAGE_SIZE);
  const shifts = useMemo(() => data?.data ?? [], [data]);
  const editingShift = useMemo(() => shifts.find((s) => s.id === editingShiftId) ?? null, [shifts, editingShiftId]);
  const createShiftMutation = useCreateShift();
  const updateShiftMutation = useUpdateShift();
  const deleteShiftMutation = useDeleteShift();

  const handleToggleStatus = useCallback(
    async (shift: Shift) => {
      const nextStatus = shift.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (nextStatus === 'INACTIVE' && !(await confirmDialog(t('shifts.deactivateConfirm')))) return;
      try {
        await updateShiftMutation.mutateAsync({ id: shift.id, status: nextStatus });
        toast.success(nextStatus === 'ACTIVE' ? t('shifts.activateSuccess') : t('shifts.deactivateSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [updateShiftMutation, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('shifts.deleteConfirm')))) return;
      try {
        await deleteShiftMutation.mutateAsync(id);
        toast.success(t('shifts.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteShiftMutation, t],
  );

  const handleCreate = useCallback(
    async (values: ShiftFormValues, { resetForm }: FormikHelpers<ShiftFormValues>) => {
      try {
        await createShiftMutation.mutateAsync(values);
        toast.success(t('shifts.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createShiftMutation, dispatch, t],
  );

  const handleUpdate = useCallback(
    async (values: ShiftFormValues) => {
      if (!editingShift) return;
      try {
        await updateShiftMutation.mutateAsync({
          id: editingShift.id,
          name: values.name,
          start_time: values.start_time,
          end_time: values.end_time,
        });
        toast.success(t('shifts.updateSuccess'));
        dispatch(closeEditModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [editingShift, updateShiftMutation, dispatch, t],
  );

  const validateShift = useCallback(
    (values: ShiftFormValues) => {
      const errors: Partial<Record<keyof ShiftFormValues, string>> = {};
      if (!values.branch_id) errors.branch_id = t('shifts.validation.branchRequired');
      if (!values.name.trim()) errors.name = t('shifts.validation.nameRequired');
      if (!values.start_time) errors.start_time = t('shifts.validation.startTimeRequired');
      if (!values.end_time) errors.end_time = t('shifts.validation.endTimeRequired');
      return errors;
    },
    [t],
  );

  return (
    <AdminLayout breadcrumb={t('shifts.breadcrumb')}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <Select
            value={selectedbranchId}
            onChange={(e) => dispatch(setSelectedbranchId(e.target.value))}
            placeholder={t('shifts.branchPlaceholder')}
            options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
          />
        </div>
        {hasPermission('shift.create') && (
          <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
            {t('shifts.addButton')}
          </Button>
        )}
        <Link to={ROUTES.ownerShiftAssignments} className="text-sm font-medium text-accent no-underline">
          {t('shifts.manageAssignments')}
        </Link>
      </div>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('shifts.addTitle')}>
          <Formik<ShiftFormValues>
            initialValues={emptyForm(selectedbranchId)}
            enableReinitialize
            validate={validateShift}
            onSubmit={handleCreate}
          >
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form>
                  <Field
                    as={Select}
                    label={t('shifts.branchLabel')}
                    name="branch_id"
                    options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                    placeholder={t('shifts.branchPlaceholder')}
                    error={showErrors ? formik.errors.branch_id : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('shifts.nameLabel')}
                    name="name"
                    className="mt-3"
                    error={showErrors ? formik.errors.name : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('shifts.startTimeLabel')}
                    name="start_time"
                    type="time"
                    className="mt-3"
                    error={showErrors ? formik.errors.start_time : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('shifts.endTimeLabel')}
                    name="end_time"
                    type="time"
                    className="mt-3"
                    error={showErrors ? formik.errors.end_time : undefined}
                  />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={createShiftMutation.isPending}>
                      {t('shifts.submit')}
                    </Button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </Modal>
      )}

      {editingShift && (
        <Modal open onClose={() => dispatch(closeEditModal())} title={t('shifts.editTitle')}>
          <Formik<ShiftFormValues> initialValues={editFormValues(editingShift)} validate={validateShift} onSubmit={handleUpdate}>
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form>
                  <Field
                    as={Input}
                    label={t('shifts.nameLabel')}
                    name="name"
                    error={showErrors ? formik.errors.name : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('shifts.startTimeLabel')}
                    name="start_time"
                    type="time"
                    className="mt-3"
                    error={showErrors ? formik.errors.start_time : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('shifts.endTimeLabel')}
                    name="end_time"
                    type="time"
                    className="mt-3"
                    error={showErrors ? formik.errors.end_time : undefined}
                  />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={updateShiftMutation.isPending}>
                      {t('shifts.saveButton')}
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
            t('shifts.headers.id'),
            t('shifts.headers.name'),
            t('shifts.headers.time'),
            t('shifts.headers.status'),
            t('shifts.headers.actions'),
          ]}
        >
          {shifts.map((shift) => (
            <tr key={shift.id}>
              <td>{shift.id}</td>
              <td>{shift.name}</td>
              <td>
                {shift.start_time} - {shift.end_time}
              </td>
              <td>
                <Badge variant={shift.status === 'ACTIVE' ? 'success' : 'default'}>
                  {shift.status === 'ACTIVE' ? t('shifts.statusActive') : t('shifts.statusInactive')}
                </Badge>
              </td>
              <td>
                <div className="flex flex-wrap gap-3">
                  {hasPermission('shift.update') && (
                    <button
                      type="button"
                      className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                      onClick={() => dispatch(openEditModal(shift.id))}
                    >
                      {t('shifts.edit')}
                    </button>
                  )}
                  {hasPermission('shift.update') && (
                    <button
                      type="button"
                      className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
                      onClick={() => handleToggleStatus(shift)}
                    >
                      {shift.status === 'ACTIVE' ? t('shifts.deactivate') : t('shifts.activate')}
                    </button>
                  )}
                  {hasPermission('shift.delete') && (
                    <button
                      type="button"
                      className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                      onClick={() => handleDelete(shift.id)}
                    >
                      {t('shifts.delete')}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default ShiftList;
