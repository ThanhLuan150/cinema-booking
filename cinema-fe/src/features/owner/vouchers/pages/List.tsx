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
import { useOwnerVouchers } from '../../hooks/useOwnerVouchers';
import { useCreateVoucher, useDeleteVoucher, useUpdateVoucher } from '../../hooks/useVoucherMutations';
import { closeAddModal, openAddModal } from '../../store/ownerVouchersSlice';
import type { VoucherFormValues } from '../../types/owner.types';
import { VoucherFormModal } from '../components/VoucherFormModal';
import { VoucherHistoryModal } from '../components/VoucherHistoryModal';
import { VoucherTable } from '../components/VoucherTable';

function VoucherList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const [historyVoucherId, setHistoryVoucherId] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data: combosPage } = useOwnerCombos(1, 100);
  const combos = useMemo(() => combosPage?.data ?? [], [combosPage]);
  const { data, isLoading } = useOwnerVouchers(page, DEFAULT_PAGE_SIZE);
  const vouchers = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.ownerVouchers);
  const createVoucherMutation = useCreateVoucher();
  const updateVoucherMutation = useUpdateVoucher();
  const deleteVoucherMutation = useDeleteVoucher();

  const toggleActive = useCallback(
    async (voucher: { id: number; active: boolean }) => {
      try {
        await updateVoucherMutation.mutateAsync({ id: voucher.id, active: !voucher.active });
      } catch (error) {
        console.error(error);
      }
    },
    [updateVoucherMutation],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('vouchers.deleteConfirm')))) return;
      try {
        await deleteVoucherMutation.mutateAsync(id);
        toast.success(t('vouchers.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteVoucherMutation, t],
  );

  const handleSubmit = useCallback(
    async (values: VoucherFormValues, { resetForm }: FormikHelpers<VoucherFormValues>) => {
      try {
        await createVoucherMutation.mutateAsync(values);
        toast.success(t('vouchers.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createVoucherMutation, dispatch, t],
  );

  return (
    <AdminLayout breadcrumb={t('vouchers.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('vouchers.addButton')}
      </Button>

      {showAddModal && (
        <VoucherFormModal
          cinemas={cinemas}
          combos={combos}
          isSubmitting={createVoucherMutation.isPending}
          onClose={() => dispatch(closeAddModal())}
          onSubmit={handleSubmit}
        />
      )}

      {historyVoucherId !== null && (
        <VoucherHistoryModal
          voucherId={historyVoucherId}
          page={historyPage}
          onPageChange={setHistoryPage}
          onClose={() => setHistoryVoucherId(null)}
        />
      )}

      <VoucherTable
        vouchers={vouchers}
        cinemas={cinemas}
        combos={combos}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onViewHistory={(id) => {
          setHistoryPage(1);
          setHistoryVoucherId(id);
        }}
        onToggleActive={toggleActive}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
}

export default VoucherList;
