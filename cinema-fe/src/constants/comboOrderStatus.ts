export const COMBO_ORDER_STATUS = {
  pending: 'PENDING',
  paid: 'PAID',
  preparing: 'PREPARING',
  ready: 'READY',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
} as const;

export const COMBO_ORDER_STATUS_META: Record<string, { key: string; className: string }> = {
  [COMBO_ORDER_STATUS.pending]: { key: 'pending', className: 'bg-amber-500/20 text-amber-400' },
  [COMBO_ORDER_STATUS.paid]: { key: 'paid', className: 'bg-blue-500/20 text-blue-400' },
  [COMBO_ORDER_STATUS.preparing]: { key: 'preparing', className: 'bg-orange-500/20 text-orange-400' },
  [COMBO_ORDER_STATUS.ready]: { key: 'ready', className: 'bg-purple-500/20 text-purple-400' },
  [COMBO_ORDER_STATUS.delivered]: { key: 'delivered', className: 'bg-green-600/20 text-green-400' },
  [COMBO_ORDER_STATUS.cancelled]: { key: 'cancelled', className: 'bg-gray-500/20 text-gray-400' },
};

// Mirrors the backend's ComboOrder.CANCELLABLE_STATUSES — used to hide the "cancel" action
// once an order is READY/DELIVERED.
export const CANCELLABLE_COMBO_ORDER_STATUSES: string[] = [
  COMBO_ORDER_STATUS.pending,
  COMBO_ORDER_STATUS.paid,
  COMBO_ORDER_STATUS.preparing,
];
