import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useCombos } from '@/features/booking/hooks/useCombos';
import { getMyCinemas } from '@/features/owner/api/owner.api';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useComboOrders } from '../hooks/useComboOrders';
import type { ComboOrderStatus } from '../types/comboOrder.types';
import { useCreateComboOrder } from '../hooks/useCreateComboOrder';
import { usePayComboOrder } from '../hooks/usePayComboOrder';
import { usePrepareComboOrder } from '../hooks/usePrepareComboOrder';
import { useReadyComboOrder } from '../hooks/useReadyComboOrder';
import { useDeliverComboOrder } from '../hooks/useDeliverComboOrder';
import { useCancelComboOrder } from '../hooks/useCancelComboOrder';
import { ComboOrdersFilters } from '../components/ComboOrdersFilters';
import { ComboOrdersTable } from '../components/ComboOrdersTable';
import { CancelOrderModal } from '../components/CancelOrderModal';
import { SellComboModal } from '../components/SellComboModal';

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
      <ComboOrdersFilters
        status={status}
        canSell={hasPermission('combo.sell')}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
        onSell={() => setShowSellModal(true)}
      />

      <ComboOrdersTable
        orders={orders}
        hasPermission={hasPermission}
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        onPay={handlePay}
        onPrepare={handlePrepare}
        onReady={handleReady}
        onDeliver={handleDeliver}
        onCancel={(id) => {
          setCancelReason('');
          setCancelModalId(id);
        }}
      />

      <CancelOrderModal
        open={cancelModalId !== null}
        reason={cancelReason}
        submitPending={cancelMutation.isPending}
        onReasonChange={setCancelReason}
        onClose={() => setCancelModalId(null)}
        onSubmit={submitCancel}
      />

      <SellComboModal
        open={showSellModal}
        needsBranchPicker={needsBranchPicker}
        branchId={sellBranchId}
        branches={branches}
        effectiveBranchId={effectiveBranchId}
        sellableCombos={sellableCombos}
        quantities={quantities}
        totalQuantity={totalQuantity}
        submitPending={createMutation.isPending}
        onBranchChange={setSellBranchId}
        onQuantityChange={setQuantity}
        onClose={closeSellModal}
        onSubmit={submitSell}
      />
    </AdminLayout>
  );
}

export default ComboOrdersPage;
