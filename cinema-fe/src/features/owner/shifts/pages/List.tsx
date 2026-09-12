import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
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
import { AddShiftModal } from '../components/AddShiftModal';
import { EditShiftModal } from '../components/EditShiftModal';
import { ShiftTable } from '../components/ShiftTable';

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

  const { data, isLoading } = useShifts(selectedbranchId || undefined, page, DEFAULT_PAGE_SIZE);
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

  return (
    <AdminLayout breadcrumb={t('shifts.breadcrumb')} loading={isLoading}>
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
        <AddShiftModal
          cinemas={cinemas}
          branchId={selectedbranchId}
          isSubmitting={createShiftMutation.isPending}
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleCreate}
        />
      )}

      {editingShift && (
        <EditShiftModal
          shift={editingShift}
          isSubmitting={updateShiftMutation.isPending}
          onClose={() => dispatch(closeEditModal())}
          onSubmit={handleUpdate}
        />
      )}

      <ShiftTable
        shifts={shifts}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        canUpdate={hasPermission('shift.update')}
        canDelete={hasPermission('shift.delete')}
        onEdit={(id) => dispatch(openEditModal(id))}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
}

export default ShiftList;
