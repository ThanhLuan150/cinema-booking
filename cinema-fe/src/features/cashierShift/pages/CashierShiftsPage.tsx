import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useCashierShifts } from '../hooks/useCashierShifts';
import { useCurrentCashierShift } from '../hooks/useCurrentCashierShift';
import { useOpenCashierShift } from '../hooks/useOpenCashierShift';
import { useCloseCashierShift } from '../hooks/useCloseCashierShift';
import { useCashierShiftReconciliation } from '../hooks/useCashierShiftReconciliation';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import type { CashierShiftStatus } from '../types/cashierShift.types';
import { CurrentShiftCard } from '../components/CurrentShiftCard';
import { OpenShiftModal } from '../components/OpenShiftModal';
import { CloseShiftModal } from '../components/CloseShiftModal';
import { CashierShiftsFilters } from '../components/CashierShiftsFilters';
import { CashierShiftsTable } from '../components/CashierShiftsTable';

function CashierShiftsPage() {
  const { t } = useTranslation('cashierShift');
  const { hasPermission } = usePermissions();
  const { data: currentUser } = useCurrentUser();

  const canOpen = hasPermission('cashierShift.open');
  const canClose = hasPermission('cashierShift.close');
  const canRead = hasPermission('cashierShift.read');

  // --- Current drawer (Open / live totals / Close) --------------------------
  const { data: current, isLoading: currentLoading } = useCurrentCashierShift(canOpen);
  const openMutation = useOpenCashierShift();
  const closeMutation = useCloseCashierShift();

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [openNote, setOpenNote] = useState('');

  const [closeTargetId, setCloseTargetId] = useState<number | null>(null);
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const { data: closeDetail } = useCashierShiftReconciliation(closeTargetId);

  const submitOpen = async () => {
    const value = Number(openingCash);
    if (!currentUser?.cinema_id || Number.isNaN(value) || value < 0) return;
    try {
      await openMutation.mutateAsync({
        branch_id: currentUser.cinema_id,
        opening_cash: value,
        note: openNote.trim() || undefined,
      });
      toast.success(t('currentShift.openSuccess'));
      setShowOpenModal(false);
      setOpeningCash('');
      setOpenNote('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const openCloseModal = (shiftId: number) => {
    setActualCash('');
    setCloseNote('');
    setCloseTargetId(shiftId);
  };

  const submitClose = async () => {
    const value = Number(actualCash);
    if (closeTargetId === null || Number.isNaN(value) || value < 0) return;
    try {
      await closeMutation.mutateAsync({
        id: closeTargetId,
        payload: { actual_cash: value, note: closeNote.trim() || undefined },
      });
      toast.success(t('currentShift.closeSuccess'));
      setCloseTargetId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  // --- Shift list -------------------------------------------------------------
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading } = useCashierShifts({
    page,
    limit: DEFAULT_PAGE_SIZE,
    status: (status || undefined) as CashierShiftStatus | undefined,
  });
  const shifts = data?.data ?? [];

  return (
    <AdminLayout breadcrumb={t('breadcrumb')} loading={(canOpen && currentLoading) || (canRead && isLoading)}>
      {canOpen && (
        <CurrentShiftCard current={current} canClose={canClose} onOpen={() => setShowOpenModal(true)} onClose={openCloseModal} />
      )}

      {canRead && (
        <>
          <CashierShiftsFilters
            status={status}
            onStatusChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />

          <CashierShiftsTable
            shifts={shifts}
            canClose={canClose}
            page={page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
            onClose={openCloseModal}
          />
        </>
      )}

      <OpenShiftModal
        open={showOpenModal}
        openingCash={openingCash}
        note={openNote}
        submitPending={openMutation.isPending}
        onOpeningCashChange={setOpeningCash}
        onNoteChange={setOpenNote}
        onClose={() => setShowOpenModal(false)}
        onSubmit={submitOpen}
      />

      <CloseShiftModal
        open={closeTargetId !== null}
        closeDetail={closeDetail}
        actualCash={actualCash}
        note={closeNote}
        submitPending={closeMutation.isPending}
        onActualCashChange={setActualCash}
        onNoteChange={setCloseNote}
        onClose={() => setCloseTargetId(null)}
        onSubmit={submitClose}
      />
    </AdminLayout>
  );
}

export default CashierShiftsPage;
