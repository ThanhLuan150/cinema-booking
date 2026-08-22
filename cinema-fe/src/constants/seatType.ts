export const SEAT_TYPES = {
  standard: 0,
  vip: 1,
  couple: 2,
} as const;

export const SEAT_TYPE_KEY: Record<number, string> = {
  [SEAT_TYPES.standard]: 'standard',
  [SEAT_TYPES.vip]: 'vip',
  [SEAT_TYPES.couple]: 'couple',
};

export const SEAT_TYPE_CLASS: Record<number, string> = {
  [SEAT_TYPES.standard]: 'bg-[#444451]',
  [SEAT_TYPES.vip]: 'bg-[#F7BB07]',
  [SEAT_TYPES.couple]: 'bg-pink-400',
};
