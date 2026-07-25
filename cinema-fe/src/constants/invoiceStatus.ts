export const INVOICE_STATUS = {
  cancelled: 0,
  booked: 1,
  refunded: 2,
} as const;

export const INVOICE_STATUS_META: Record<number, { key: string; className: string }> = {
  [INVOICE_STATUS.booked]: { key: 'booked', className: 'bg-green-600/20 text-green-400' },
  [INVOICE_STATUS.cancelled]: { key: 'cancelled', className: 'bg-gray-500/20 text-gray-400' },
  [INVOICE_STATUS.refunded]: { key: 'refunded', className: 'bg-amber-500/20 text-amber-400' },
};
