import type { PrivateEventStatus } from '@/types/entities';

export const STATUS_VARIANT: Record<PrivateEventStatus, 'default' | 'warning' | 'success'> = {
  REQUESTED: 'warning',
  QUOTED: 'warning',
  APPROVED: 'warning',
  PAID: 'success',
  CONFIRMED: 'success',
  COMPLETED: 'default',
  CANCELLED: 'default',
};
