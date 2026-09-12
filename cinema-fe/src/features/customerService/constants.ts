import type { SupportTicketCategory, SupportTicketStatus } from '@/types/entities';

export const ALL_BRANCHES = 'ALL';

export const CATEGORIES: SupportTicketCategory[] = ['GENERAL', 'COMPLAINT', 'BOOKING_SUPPORT', 'REFUND_SUPPORT', 'SHOWTIME_CHANGE'];
export const STATUSES: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export const STATUS_VARIANT: Record<SupportTicketStatus, 'warning' | 'accent' | 'success' | 'default'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'accent',
  RESOLVED: 'success',
  CLOSED: 'default',
};
