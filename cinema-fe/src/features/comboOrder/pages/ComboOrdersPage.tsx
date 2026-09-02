import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/cn';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useCombos } from '@/features/booking/hooks/useCombos';
import { getMyCinemas } from '@/features/owner/api/owner.api';
import { COMBO_ORDER_STATUS, COMBO_ORDER_STATUS_META, CANCELLABLE_COMBO_ORDER_STATUSES } from '@/constants/comboOrderStatus';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useComboOrders } from '../hooks/useComboOrders';
import type { ComboOrderStatus } from '../types/comboOrder.types';
import { useCreateComboOrder } from '../hooks/useCreateComboOrder';
import { usePayComboOrder } from '../hooks/usePayComboOrder';
import { usePrepareComboOrder } from '../hooks/usePrepareComboOrder';
import { useReadyComboOrder } from '../hooks/useReadyComboOrder';
import { useDeliverComboOrder } from '../hooks/useDeliverComboOrder';
import { useCancelComboOrder } from '../hooks/useCancelComboOrder';

function ComboOrdersPage() {
  const { t } = useTranslation('comboOrder');
  const { hasPermission } = usePermissions();
  const { data: currentUser } = useCurrentUser();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, isLoading } = useComboOrders({
    page,
    limit: DEFAULT_PAGE_SIZE,
    status: (status || undefined) as ComboOrderStatus | undefined,
  });
  const orders = data?.data ?? [];

  const payMutation = usePayComboOrder();
  const prepareMutation = usePrepareComboOrder();
  const readyMutation = useReadyComboOrder();
  const deliverMutation = useDeliverComboOrder();
  const cancelMutation = useCancelComboOrder();
  const createMutation = useCreateComboOrder();

  const [cancelModalId, setCancelModalId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [showSellModal, setShowSellModal] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  // Employees (Combo Staff/Cashier) are tied to one branch via currentUser.cinema_id — for
  // them the branch is implicit. Any other combo.sell holder (only SUPER_ADMIN, per RBAC) has
  // no cinema_id, so they pick a branch explicitly instead of the button just staying disabled.
  const needsBranchPicker = !currentUser?.cinema_id;
  const [sellBranchId, setSellBranchId] = useState('');
  const { data: branchesPage } = useQuery({
    queryKey: ['myCinemas', 'comboOrderSell'],
    queryFn: () => getMyCinemas({ limit: FULL_LIST_FETCH_LIMIT }),
    enabled: showSellModal && needsBranchPicker,
  });
  const branches = branchesPage?.data ?? [];
  const effectiveBranchId = currentUser?.cinema_id ?? (sellBranchId ? Number(sellBranchId) : null);

  const { data: catalog } = useCombos(showSellModal ? effectiveBranchId : null);
  const sellableCombos = useMemo(() => (catalog ?? []).filter((combo) => combo.active), [catalog]);

  const handlePay = useCallback(
    async (id: number) => {
      try {
        await payMutation.mutateAsync({ id, method: 'CASH' });
        toast.success(t('paySuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [payMutation, t],
  );

  const handlePrepare = useCallback(
    async (id: number) => {
      try {
        await prepareMutation.mutateAsync(id);
        toast.success(t('prepareSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [prepareMutation, t],
  );

  const handleReady = useCallback(
    async (id: number) => {
      try {
        await readyMutation.mutateAsync(id);
        toast.success(t('readySuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [readyMutation, t],
  );

  const handleDeliver = useCallback(
    async (id: number) => {
      try {
        await deliverMutation.mutateAsync(id);
        toast.success(t('deliverSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deliverMutation, t],
  );

  const submitCancel = async () => {
    if (cancelModalId === null) return;
    try {
      await cancelMutation.mutateAsync({ id: cancelModalId, reason: cancelReason.trim() || undefined });
      toast.success(t('cancelSuccess'));
      setCancelModalId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const setQuantity = (comboId: number, quantity: number) => {
    setQuantities((current) => ({ ...current, [comboId]: Math.max(0, quantity) }));
  };

  const closeSellModal = () => {
    setShowSellModal(false);
    setQuantities({});
    setSellBranchId('');
  };

  const submitSell = async () => {
    if (!effectiveBranchId) return;
    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([comboId, quantity]) => ({ combo_id: Number(comboId), quantity }));
    if (items.length === 0) return;

    try {
      await createMutation.mutateAsync({ branch_id: effectiveBranchId, items });
      toast.success(t('sellSuccess'));
      closeSellModal();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const totalQuantity = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);

  return (
    <AdminLayout breadcrumb={t('breadcrumb')} loading={isLoading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            placeholder={t('statusFilterPlaceholder')}
            options={Object.values(COMBO_ORDER_STATUS).map((value) => ({
              label: t(`status.${COMBO_ORDER_STATUS_META[value].key}`),
              value,
            }))}
          />
        </div>
        {hasPermission('combo.sell') && (
          <Button type="button" variant="danger" onClick={() => setShowSellModal(true)}>
            {t('sellButton')}
          </Button>
        )}
      </div>

      <div className="mt-6">
        <DataTable
          headers={[
            t('headers.code'),
            t('headers.items'),
            t('headers.total'),
            t('headers.status'),
            t('headers.actions'),
          ]}
        >
          {orders.map((order) => {
            const meta = COMBO_ORDER_STATUS_META[order.status];
            const isCancellable = CANCELLABLE_COMBO_ORDER_STATUSES.includes(order.status);
            return (
              <tr key={order.id}>
                <td>{order.code}</td>
                <td>{order.items.map((item) => `${item.name} x${item.quantity}`).join(', ')}</td>
                <td>{order.total_price.toLocaleString()}đ</td>
                <td>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide', meta?.className)}>
                    {t(`status.${meta?.key ?? 'pending'}`)}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-3">
                    {hasPermission('payment.create') && order.status === COMBO_ORDER_STATUS.pending && (
                      <button
                        type="button"
                        className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                        onClick={() => handlePay(order.id)}
                      >
                        {t('payButton')}
                      </button>
                    )}
                    {hasPermission('combo.order.update') && order.status === COMBO_ORDER_STATUS.paid && (
                      <button
                        type="button"
                        className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                        onClick={() => handlePrepare(order.id)}
                      >
                        {t('prepareButton')}
                      </button>
                    )}
                    {hasPermission('combo.order.update') && order.status === COMBO_ORDER_STATUS.preparing && (
                      <button
                        type="button"
                        className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                        onClick={() => handleReady(order.id)}
                      >
                        {t('readyButton')}
                      </button>
                    )}
                    {hasPermission('combo.order.update') && order.status === COMBO_ORDER_STATUS.ready && (
                      <button
                        type="button"
                        className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                        onClick={() => handleDeliver(order.id)}
                      >
                        {t('deliverButton')}
                      </button>
                    )}
                    {hasPermission('combo.order.update') && isCancellable && (
                      <button
                        type="button"
                        className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                        onClick={() => {
                          setCancelReason('');
                          setCancelModalId(order.id);
                        }}
                      >
                        {t('cancelButton')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>

      <Modal open={cancelModalId !== null} onClose={() => setCancelModalId(null)} title={t('cancelModalTitle')}>
        <Textarea
          label={t('cancelReasonLabel')}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={4}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setCancelModalId(null)}>
            {t('common:actions.close')}
          </Button>
          <Button type="button" variant="danger" loading={cancelMutation.isPending} onClick={submitCancel}>
            {t('common:actions.confirm')}
          </Button>
        </div>
      </Modal>

      <Modal open={showSellModal} onClose={closeSellModal} title={t('sellModalTitle')}>
        {needsBranchPicker && (
          <Select
            label={t('sellBranchLabel')}
            value={sellBranchId}
            onChange={(e) => setSellBranchId(e.target.value)}
            placeholder={t('sellBranchPlaceholder')}
            options={branches.map((branch) => ({ label: branch.name, value: branch.id }))}
          />
        )}
        {!effectiveBranchId ? (
          <p className="mt-3 text-sm text-txt/60">{t('sellSelectBranchFirst')}</p>
        ) : sellableCombos.length === 0 ? (
          <p className="mt-3 text-sm text-txt/60">{t('noItems')}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {sellableCombos.map((combo) => (
              <div key={combo.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-txt">{combo.name}</p>
                  <p className="text-xs text-txt/60">{combo.price.toLocaleString()}đ</p>
                </div>
                <input
                  type="number"
                  min={0}
                  value={quantities[combo.id] ?? 0}
                  onChange={(e) => setQuantity(combo.id, Number(e.target.value))}
                  className="w-20 rounded-lg border border-border-strong bg-surface-soft px-2 py-1.5 text-right text-txt"
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={closeSellModal}>
            {t('common:actions.close')}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={createMutation.isPending}
            disabled={totalQuantity === 0 || !effectiveBranchId}
            onClick={submitSell}
          >
            {t('sellSubmit')}
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}

export default ComboOrdersPage;
