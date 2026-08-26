export const POINTS_TRANSACTION_TYPE = {
  earn: 'EARN',
  redeem: 'REDEEM',
  expire: 'EXPIRE',
  reversal: 'REVERSAL',
  adjust: 'ADJUST',
} as const;

export const POINTS_TRANSACTION_TYPE_META: Record<string, { key: string; className: string }> = {
  [POINTS_TRANSACTION_TYPE.earn]: { key: 'earn', className: 'bg-green-600/20 text-green-400' },
  [POINTS_TRANSACTION_TYPE.redeem]: { key: 'redeem', className: 'bg-blue-500/20 text-blue-400' },
  [POINTS_TRANSACTION_TYPE.expire]: { key: 'expire', className: 'bg-gray-500/20 text-gray-400' },
  [POINTS_TRANSACTION_TYPE.reversal]: { key: 'reversal', className: 'bg-red-500/20 text-red-400' },
  [POINTS_TRANSACTION_TYPE.adjust]: { key: 'adjust', className: 'bg-amber-500/20 text-amber-400' },
};
