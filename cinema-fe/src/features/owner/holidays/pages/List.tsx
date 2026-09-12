import { useCallback, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerHolidays } from '../../hooks/useOwnerHolidays';
import { useCreateHoliday, useDeleteHoliday } from '../../hooks/useHolidayMutations';
import { closeAddModal, openAddModal } from '../../store/ownerHolidaysSlice';
import type { HolidayFormValues } from '../../types/owner.types';
import { ALL_BRANCHES } from '../constants';
import { HolidayFormModal } from '../components/HolidayFormModal';
import { HolidayTable } from '../components/HolidayTable';

function HolidayList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const isAdmin = useAuthRole() === ROLES.admin;

  const [page, setPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const defaultBranchId = isAdmin ? '' : cinemas.length > 0 ? String(cinemas[0].id) : '';

  const { data, isLoading } = useOwnerHolidays(undefined, page, DEFAULT_PAGE_SIZE);
  const holidays = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.ownerHolidays);
  const createHolidayMutation = useCreateHoliday();
  const deleteHolidayMutation = useDeleteHoliday();

  const branchOptions = useMemo(() => {
    const options = cinemas.map((c) => ({ label: c.name, value: String(c.id) }));
    return [{ label: t('holidays.allBranchesOption'), value: ALL_BRANCHES }, ...options];
  }, [cinemas, t]);

  const handleCreate = useCallback(
    async (values: HolidayFormValues, { resetForm }: FormikHelpers<HolidayFormValues>) => {
      try {
        await createHolidayMutation.mutateAsync({
          date: values.date,
          name: values.name,
          branch_id: values.branch_id === ALL_BRANCHES ? null : Number(values.branch_id),
        });
        toast.success(t('holidays.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createHolidayMutation, dispatch, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('holidays.deleteConfirm')))) return;
      try {
        await deleteHolidayMutation.mutateAsync(id);
        toast.success(t('holidays.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteHolidayMutation, t],
  );

  return (
    <AdminLayout breadcrumb={t('holidays.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('holidays.addButton')}
      </Button>

      {showAddModal && (
        <HolidayFormModal
          defaultBranchId={defaultBranchId}
          branchOptions={branchOptions}
          isSubmitting={createHolidayMutation.isPending}
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleCreate}
        />
      )}

      <HolidayTable
        holidays={holidays}
        branchNameById={branchNameById}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
}

export default HolidayList;
