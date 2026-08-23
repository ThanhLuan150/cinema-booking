export const BOOKING_STATUS = {
  pending: 'PENDING',
  paid: 'PAID',
  cancelled: 'CANCELLED',
  expired: 'EXPIRED',
  completed: 'COMPLETED',
} as const;

export const BOOKING_STATUS_META: Record<string, { key: string; className: string }> = {
  [BOOKING_STATUS.pending]: { key: 'pending', className: 'bg-amber-500/20 text-amber-400' },
  [BOOKING_STATUS.paid]: { key: 'paid', className: 'bg-green-600/20 text-green-400' },
  [BOOKING_STATUS.cancelled]: { key: 'cancelled', className: 'bg-gray-500/20 text-gray-400' },
  [BOOKING_STATUS.expired]: { key: 'expired', className: 'bg-red-500/20 text-red-400' },
  [BOOKING_STATUS.completed]: { key: 'completed', className: 'bg-blue-500/20 text-blue-400' },
};

export const CANCELLABLE_BOOKING_STATUSES: string[] = [BOOKING_STATUS.pending, BOOKING_STATUS.paid];
