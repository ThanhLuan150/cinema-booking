export const REFUND_STATUS = {
  requested: 'REQUESTED',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  processing: 'PROCESSING',
  completed: 'COMPLETED',
  failed: 'FAILED',
} as const;

export const REFUND_STATUS_META: Record<string, { key: string; className: string }> = {
  [REFUND_STATUS.requested]: { key: 'requested', className: 'bg-amber-500/20 text-amber-400' },
  [REFUND_STATUS.approved]: { key: 'approved', className: 'bg-blue-500/20 text-blue-400' },
  [REFUND_STATUS.rejected]: { key: 'rejected', className: 'bg-red-500/20 text-red-400' },
  [REFUND_STATUS.processing]: { key: 'processing', className: 'bg-orange-500/20 text-orange-400' },
  [REFUND_STATUS.completed]: { key: 'completed', className: 'bg-green-600/20 text-green-400' },
  [REFUND_STATUS.failed]: { key: 'failed', className: 'bg-gray-500/20 text-gray-400' },
};

// A booking can only have one active (non-terminal) refund in flight — mirrors the backend's
// Refund.ACTIVE_STATUSES, used to hide the "Request refund" button while one is outstanding.
export const ACTIVE_REFUND_STATUSES: string[] = [
  REFUND_STATUS.requested,
  REFUND_STATUS.approved,
  REFUND_STATUS.processing,
];
