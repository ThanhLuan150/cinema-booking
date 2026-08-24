export const PAYMENT_STATUS = {
  pending: 'PENDING',
  processing: 'PROCESSING',
  paid: 'PAID',
  failed: 'FAILED',
  refundPending: 'REFUND_PENDING',
  refunded: 'REFUNDED',
} as const;

export const PAYMENT_STATUS_META: Record<string, { key: string; className: string }> = {
  [PAYMENT_STATUS.pending]: { key: 'pending', className: 'bg-amber-500/20 text-amber-400' },
  [PAYMENT_STATUS.processing]: { key: 'processing', className: 'bg-blue-500/20 text-blue-400' },
  [PAYMENT_STATUS.paid]: { key: 'paid', className: 'bg-green-600/20 text-green-400' },
  [PAYMENT_STATUS.failed]: { key: 'failed', className: 'bg-red-500/20 text-red-400' },
  [PAYMENT_STATUS.refundPending]: { key: 'refundPending', className: 'bg-orange-500/20 text-orange-400' },
  [PAYMENT_STATUS.refunded]: { key: 'refunded', className: 'bg-gray-500/20 text-gray-400' },
};

export const PAYMENT_TYPE = {
  online: 'ONLINE',
  counter: 'COUNTER',
} as const;

export const PAYMENT_TYPE_META: Record<string, { key: string }> = {
  [PAYMENT_TYPE.online]: { key: 'online' },
  [PAYMENT_TYPE.counter]: { key: 'counter' },
};
