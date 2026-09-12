import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { cn } from '@/lib/cn';
import { COMBO_ORDER_STATUS, COMBO_ORDER_STATUS_META, CANCELLABLE_COMBO_ORDER_STATUSES } from '@/constants/comboOrderStatus';
import type { ComboOrder } from '../types/comboOrder.types';

export function ComboOrdersTable({
  orders,
  hasPermission,
  page,
  totalPages,
  onPageChange,
  onPay,
  onPrepare,
  onReady,
  onDeliver,
  onCancel,
}: {
  orders: ComboOrder[];
  hasPermission: (permission: string) => boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPay: (id: number) => void;
  onPrepare: (id: number) => void;
  onReady: (id: number) => void;
  onDeliver: (id: number) => void;
  onCancel: (id: number) => void;
}) {
  const { t } = useTranslation('comboOrder');
  return (
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
                      onClick={() => onPay(order.id)}
                    >
                      {t('payButton')}
                    </button>
                  )}
                  {hasPermission('combo.order.update') && order.status === COMBO_ORDER_STATUS.paid && (
                    <button
                      type="button"
                      className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                      onClick={() => onPrepare(order.id)}
                    >
                      {t('prepareButton')}
                    </button>
                  )}
                  {hasPermission('combo.order.update') && order.status === COMBO_ORDER_STATUS.preparing && (
                    <button
                      type="button"
                      className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                      onClick={() => onReady(order.id)}
                    >
                      {t('readyButton')}
                    </button>
                  )}
                  {hasPermission('combo.order.update') && order.status === COMBO_ORDER_STATUS.ready && (
                    <button
                      type="button"
                      className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                      onClick={() => onDeliver(order.id)}
                    >
                      {t('deliverButton')}
                    </button>
                  )}
                  {hasPermission('combo.order.update') && isCancellable && (
                    <button
                      type="button"
                      className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                      onClick={() => onCancel(order.id)}
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
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
