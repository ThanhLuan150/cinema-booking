export const CASHIER_SHIFT_STATUS = {
  open: 'OPEN',
  closed: 'CLOSED',
} as const;

export const CASHIER_SHIFT_STATUS_META: Record<string, { key: string; className: string }> = {
  [CASHIER_SHIFT_STATUS.open]: { key: 'open', className: 'bg-blue-500/20 text-blue-400' },
  [CASHIER_SHIFT_STATUS.closed]: { key: 'closed', className: 'bg-gray-500/20 text-gray-400' },
};
