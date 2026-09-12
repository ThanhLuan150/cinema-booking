import type { PrivateEventStatus } from '@/types/entities';

export const ALL_BRANCHES = 'ALL';

export const STATUSES: PrivateEventStatus[] = [
  'REQUESTED',
  'QUOTED',
  'APPROVED',
  'PAID',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
];

export const STATUS_VARIANT: Record<PrivateEventStatus, 'default' | 'warning' | 'success'> = {
  REQUESTED: 'warning',
  QUOTED: 'warning',
  APPROVED: 'warning',
  PAID: 'success',
  CONFIRMED: 'success',
  COMPLETED: 'default',
  CANCELLED: 'default',
};

export function formatDateOrDash(v: string | null) {
  return v ? new Date(v).toLocaleString() : '—';
}
