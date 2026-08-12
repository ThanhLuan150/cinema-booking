export const CINEMA_STATUS = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
  maintenance: 'MAINTENANCE',
} as const;

export const CINEMA_STATUS_META: Record<string, { key: string; className: string }> = {
  [CINEMA_STATUS.active]: { key: 'active', className: 'bg-green-600/20 text-green-400' },
  [CINEMA_STATUS.inactive]: { key: 'inactive', className: 'bg-red-600/20 text-red-400' },
  [CINEMA_STATUS.maintenance]: { key: 'maintenance', className: 'bg-amber-500/20 text-amber-400' },
};
