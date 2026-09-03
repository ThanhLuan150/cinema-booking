import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/cn';
import { CASHIER_SHIFT_STATUS, CASHIER_SHIFT_STATUS_META } from '@/constants/cashierShiftStatus';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useCashierShifts } from '../hooks/useCashierShifts';
import { useCurrentCashierShift } from '../hooks/useCurrentCashierShift';
import { useOpenCashierShift } from '../hooks/useOpenCashierShift';
import { useCloseCashierShift } from '../hooks/useCloseCashierShift';
import { useCashierShiftReconciliation } from '../hooks/useCashierShiftReconciliation';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import type { CashierShiftStatus } from '../types/cashierShift.types';

function money(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString()}đ`;
}

function DifferenceValue({ value }: { value: number | null }) {
  if (value === null) return <span>—</span>;
  const className = value === 0 ? 'text-txt' : value > 0 ? 'text-emerald-400' : 'text-red-400';
  const sign = value > 0 ? '+' : '';
  return <span className={className}>{`${sign}${value.toLocaleString()}đ`}</span>;
}

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
        <Card className="mb-6">
          <CardBody>
            <CardTitle>{t('currentShift.title')}</CardTitle>
            {!current?.shift ? (
              <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-txt/60">{t('currentShift.noShiftOpen')}</p>
                <Button type="button" variant="danger" onClick={() => setShowOpenModal(true)}>
                  {t('currentShift.openButton')}
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-txt/60">{t('reconciliation.openingCash')}</dt>
                    <dd className="font-semibold">{money(current.reconciliation?.openingCash ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="text-txt/60">{t('reconciliation.cashSales')}</dt>
                    <dd className="font-semibold">{money(current.reconciliation?.cashSales ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="text-txt/60">{t('reconciliation.cashRefunds')}</dt>
                    <dd className="font-semibold">{money(current.reconciliation?.cashRefunds ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="text-txt/60">{t('reconciliation.expectedCash')}</dt>
                    <dd className="font-semibold text-accent">{money(current.reconciliation?.expectedCash ?? null)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-txt/50">
                  {t('currentShift.openedAt', { time: new Date(current.shift.opened_at).toLocaleString() })}
                </p>
                {canClose && (
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-4"
                    onClick={() => openCloseModal(current.shift!.id)}
                  >
                    {t('currentShift.closeButton')}
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {canRead && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-56">
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                placeholder={t('statusFilterPlaceholder')}
                options={Object.values(CASHIER_SHIFT_STATUS).map((value) => ({
                  label: t(`status.${CASHIER_SHIFT_STATUS_META[value].key}`),
                  value,
                }))}
              />
            </div>
          </div>

          <div className="mt-6">
            <DataTable
              headers={[
                t('headers.id'),
                t('headers.employee'),
                t('headers.openedAt'),
                t('headers.closedAt'),
                t('headers.openingCash'),
                t('headers.expectedCash'),
                t('headers.actualCash'),
                t('headers.difference'),
                t('headers.status'),
                t('headers.actions'),
              ]}
            >
              {shifts.map((shift) => {
                const meta = CASHIER_SHIFT_STATUS_META[shift.status];
                return (
                  <tr key={shift.id}>
                    <td>{shift.id}</td>
                    <td>#{shift.employee_id}</td>
                    <td className="whitespace-nowrap text-sm">{new Date(shift.opened_at).toLocaleString()}</td>
                    <td className="whitespace-nowrap text-sm">
                      {shift.closed_at ? new Date(shift.closed_at).toLocaleString() : '—'}
                    </td>
                    <td>{money(shift.opening_cash)}</td>
                    <td>{money(shift.expected_cash)}</td>
                    <td>{money(shift.actual_cash)}</td>
                    <td>
                      <DifferenceValue value={shift.difference} />
                    </td>
                    <td>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide', meta?.className)}>
                        {t(`status.${meta?.key ?? 'open'}`)}
                      </span>
                    </td>
                    <td>
                      {canClose && shift.status === CASHIER_SHIFT_STATUS.open && (
                        <button
                          type="button"
                          className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                          onClick={() => openCloseModal(shift.id)}
                        >
                          {t('currentShift.closeButton')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
            <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
          </div>
        </>
      )}

      <Modal open={showOpenModal} onClose={() => setShowOpenModal(false)} title={t('currentShift.openModalTitle')}>
        <div className="flex flex-col gap-4">
          <Input
            label={t('currentShift.openingCashLabel')}
            type="number"
            min={0}
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            placeholder={t('currentShift.openingCashPlaceholder')}
          />
          <Textarea
            label={t('currentShift.noteLabel')}
            value={openNote}
            onChange={(e) => setOpenNote(e.target.value)}
            rows={3}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setShowOpenModal(false)}>
            {t('common:actions.close')}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={openMutation.isPending}
            disabled={!openingCash || Number(openingCash) < 0}
            onClick={submitOpen}
          >
            {t('currentShift.openSubmit')}
          </Button>
        </div>
      </Modal>

      <Modal open={closeTargetId !== null} onClose={() => setCloseTargetId(null)} title={t('currentShift.closeModalTitle')}>
        {closeDetail?.reconciliation && (
          <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-txt/60">{t('reconciliation.openingCash')}</dt>
              <dd>{money(closeDetail.reconciliation.openingCash)}</dd>
            </div>
            <div>
              <dt className="text-txt/60">{t('reconciliation.cashSales')}</dt>
              <dd>{money(closeDetail.reconciliation.cashSales)}</dd>
            </div>
            <div>
              <dt className="text-txt/60">{t('reconciliation.cashRefunds')}</dt>
              <dd>{money(closeDetail.reconciliation.cashRefunds)}</dd>
            </div>
            <div>
              <dt className="text-txt/60">{t('reconciliation.expectedCash')}</dt>
              <dd className="font-semibold text-accent">{money(closeDetail.reconciliation.expectedCash)}</dd>
            </div>
          </dl>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label={t('currentShift.actualCashLabel')}
            type="number"
            min={0}
            value={actualCash}
            onChange={(e) => setActualCash(e.target.value)}
            placeholder={t('currentShift.actualCashPlaceholder')}
          />
          <Textarea
            label={t('currentShift.closeNoteLabel')}
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
            rows={3}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setCloseTargetId(null)}>
            {t('common:actions.close')}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={closeMutation.isPending}
            disabled={!actualCash || Number(actualCash) < 0}
            onClick={submitClose}
          >
            {t('currentShift.closeSubmit')}
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}

export default CashierShiftsPage;
