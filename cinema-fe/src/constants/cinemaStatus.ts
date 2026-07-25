export const CINEMA_STATUS = {
  pending: 0,
  approved: 1,
  blocked: 2,
} as const;

export const CINEMA_STATUS_META: Record<number, { key: string; className: string }> = {
  [CINEMA_STATUS.pending]: { key: 'pending', className: 'bg-amber-500/20 text-amber-400' },
  [CINEMA_STATUS.approved]: { key: 'approved', className: 'bg-green-600/20 text-green-400' },
  [CINEMA_STATUS.blocked]: { key: 'blocked', className: 'bg-red-600/20 text-red-400' },
};
