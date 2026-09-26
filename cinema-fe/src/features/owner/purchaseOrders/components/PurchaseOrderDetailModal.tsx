import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/format';
import type { PurchaseOrder } from '@/types/entities';
import {
  useCancelPurchaseOrder,
  useConfirmPurchaseOrder,
  useDeletePurchaseOrder,
  useReceivePurchaseOrder,
} from '../hooks/usePurchaseOrders';
import { STATUS_VARIANT, displayDay } from '../orderForm';

interface PurchaseOrderDetailModalProps {
  order: PurchaseOrder;
  branchName?: string;
  // purchaseOrder.manage: edit a draft, confirm, cancel, delete. purchaseOrder.receive: bring the
  // stock in. They are separate permissions, so either may be held without the other.
  canManage: boolean;
  canReceive: boolean;
  onEdit: (order: PurchaseOrder) => void;
  onChanged: (order: PurchaseOrder) => void;
  onClose: () => void;
}

export function PurchaseOrderDetailModal({
  order,
  branchName,
  canManage,
  canReceive,
  onEdit,
  onChanged,
  onClose,
}: PurchaseOrderDetailModalProps) {
  const { t, i18n } = useTranslation('owner');
  const confirmMutation = useConfirmPurchaseOrder();
  const cancelMutation = useCancelPurchaseOrder();
  const deleteMutation = useDeletePurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const busy =
    confirmMutation.isPending ||
    cancelMutation.isPending ||
    deleteMutation.isPending ||
    receiveMutation.isPending;

  const run = async (
    action: () => Promise<PurchaseOrder | void>,
    successKey: string,
    closeAfter = false,
  ) => {
    try {
      const result = await action();
      toast.success(t(successKey));
      if (result) onChanged(result);
      if (closeAfter) onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const confirmOrder = async () => {
    if (!(await confirmDialog(t('purchaseOrders.confirmConfirm', { code: order.code })))) return;
    await run(() => confirmMutation.mutateAsync(order.id), 'purchaseOrders.confirmSuccess');
  };
  const cancelOrder = async () => {
    if (!(await confirmDialog(t('purchaseOrders.cancelConfirm', { code: order.code })))) return;
    await run(() => cancelMutation.mutateAsync({ id: order.id }), 'purchaseOrders.cancelSuccess');
  };
  const deleteOrder = async () => {
    if (!(await confirmDialog(t('purchaseOrders.deleteConfirm', { code: order.code })))) return;
    await run(
      () => deleteMutation.mutateAsync(order.id).then(() => undefined),
      'purchaseOrders.deleteSuccess',
      true,
    );
  };
  const receiveOrder = async () => {
    if (
      !(await confirmDialog(
        t('purchaseOrders.receiveConfirm', { code: order.code, count: order.items.length }),
      ))
    )
      return;
    await run(() => receiveMutation.mutateAsync(order.id), 'purchaseOrders.receiveSuccess');
  };

  // Nothing to offer on a RECEIVED/CANCELLED order (or to someone who may only read), so no empty bar.
  const hasActions =
    (canManage && (order.status === 'DRAFT' || order.status === 'ORDERED')) ||
    (canReceive && order.status === 'ORDERED');

  const dateRow = (label: string, value: string | null) => (
    <div>
      <dt className="text-xs uppercase tracking-wide text-txt/50">{label}</dt>
      <dd className="text-sm">{displayDay(value, i18n.language)}</dd>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={t('purchaseOrders.detailTitle', { code: order.code })}
      className="!max-w-3xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={STATUS_VARIANT[order.status]}>
            {t(`purchaseOrders.status.${order.status}`)}
          </Badge>
          <span className="text-sm text-txt/70">
            {order.supplier
              ? `${order.supplier.name} (${order.supplier.code})`
              : `#${order.supplier_id}`}
          </span>
          {branchName && <span className="text-sm text-txt/50">· {branchName}</span>}
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dateRow(t('purchaseOrders.fields.orderDate'), order.order_date)}
          {dateRow(t('purchaseOrders.fields.expectedDate'), order.expected_date)}
          {order.received_at && dateRow(t('purchaseOrders.receivedAt'), order.received_at)}
          {order.cancelled_at && dateRow(t('purchaseOrders.cancelledAt'), order.cancelled_at)}
        </dl>
        {order.note && <p className="text-sm text-txt/70">{order.note}</p>}
        {order.status === 'CANCELLED' && order.cancel_reason && (
          <p className="text-sm text-txt/70">
            {t('purchaseOrders.cancelReason', { reason: order.cancel_reason })}
          </p>
        )}

        <div className="no-scrollbar overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-surface-soft text-xs uppercase text-txt/60">
              <tr>
                <th className="px-3 py-2">{t('purchaseOrders.fields.product')}</th>
                <th className="px-3 py-2 text-right">{t('purchaseOrders.fields.quantity')}</th>
                <th className="px-3 py-2 text-right">{t('purchaseOrders.fields.unitCost')}</th>
                <th className="px-3 py-2 text-right">{t('purchaseOrders.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((line) => (
                <tr key={line.inventory_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {line.item}
                    {line.sku && <span className="ml-1 text-txt/50">· {line.sku}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {line.quantity} {line.unit}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(line.unit_cost, i18n.language)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(line.line_total, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong font-semibold">
                <td className="px-3 py-2" colSpan={3}>
                  {t('purchaseOrders.totalLabel')}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(order.total_amount, i18n.language)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {order.status === 'ORDERED' && (
          <p className="text-sm text-txt/60">{t('purchaseOrders.orderedHint')}</p>
        )}

        {hasActions && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            {order.status === 'DRAFT' && canManage && (
              <>
                <Button type="button" variant="ghost" disabled={busy} onClick={deleteOrder}>
                  {t('purchaseOrders.delete')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onEdit(order)}
                >
                  {t('purchaseOrders.edit')}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  loading={confirmMutation.isPending}
                  disabled={busy}
                  onClick={confirmOrder}
                >
                  {t('purchaseOrders.confirmOrder')}
                </Button>
              </>
            )}
            {(order.status === 'DRAFT' || order.status === 'ORDERED') && canManage && (
              <Button
                type="button"
                variant="outline"
                loading={cancelMutation.isPending}
                disabled={busy}
                onClick={cancelOrder}
              >
                {t('purchaseOrders.cancelOrder')}
              </Button>
            )}
            {order.status === 'ORDERED' && canReceive && (
              <Button
                type="button"
                variant="success"
                loading={receiveMutation.isPending}
                disabled={busy}
                onClick={receiveOrder}
              >
                {t('purchaseOrders.receiveStock')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
