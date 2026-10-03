import type { InSeatOrderStatus } from './types/inSeat.types';

export const IN_SEAT_STATUS_CLASS: Record<InSeatOrderStatus, string> = {
  PENDING: 'bg-amber-500/20 text-amber-300',
  PAID: 'bg-sky-500/20 text-sky-300',
  PREPARING: 'bg-violet-500/20 text-violet-300',
  READY: 'bg-emerald-500/20 text-emerald-300',
  DELIVERED: 'bg-green-600/20 text-green-300',
  CANCELLED: 'bg-red-500/20 text-red-300',
};
