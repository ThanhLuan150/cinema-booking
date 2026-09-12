import { useCallback, useMemo, useState } from 'react';
import type { FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerCombos } from '../../hooks/useOwnerCombos';
import { useCreateCombo, useDeleteCombo, useUpdateCombo } from '../../hooks/useComboMutations';
import { closeAddModal, openAddModal } from '../../store/ownerCombosSlice';
import type { ComboFormValues } from '../../types/owner.types';
import { ComboFormModal } from '../components/ComboFormModal';
import { ComboTable } from '../components/ComboTable';

function ComboList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data, isLoading } = useOwnerCombos(page, DEFAULT_PAGE_SIZE);
  const combos = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.ownerCombos);
  const createComboMutation = useCreateCombo();
  const updateComboMutation = useUpdateCombo();
  const deleteComboMutation = useDeleteCombo();

  const toggleActive = useCallback(
    async (combo: { id: number; active: boolean }) => {
      try {
        await updateComboMutation.mutateAsync({ id: combo.id, active: !combo.active });
      } catch (error) {
        console.error(error);
      }
    },
    [updateComboMutation],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('combos.deleteConfirm')))) return;
      try {
        await deleteComboMutation.mutateAsync(id);
        toast.success(t('combos.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteComboMutation, t],
  );

  const handleSubmit = useCallback(
    async (values: ComboFormValues, { resetForm }: FormikHelpers<ComboFormValues>) => {
      try {
        await createComboMutation.mutateAsync(values);
        toast.success(t('combos.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createComboMutation, dispatch, t],
  );

  return (
    <AdminLayout breadcrumb={t('combos.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('combos.addButton')}
      </Button>

      {showAddModal && (
        <ComboFormModal
          cinemas={cinemas}
          isSubmitting={createComboMutation.isPending}
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleSubmit}
        />
      )}

      <ComboTable
        combos={combos}
        cinemas={cinemas}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onToggleActive={toggleActive}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
}

export default ComboList;
