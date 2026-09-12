import type { BoxOfficePaymentMethod } from './types/boxOffice.types';

export const PAYMENT_METHODS: BoxOfficePaymentMethod[] = ['CASH', 'CARD', 'QR_PAYMENT'];

export const ISSUED_TICKET_BADGE: Record<string, { variant: 'success' | 'default' | 'warning'; key: string }> = {
  ISSUED: { variant: 'default', key: 'statusIssued' },
  USED: { variant: 'success', key: 'statusUsed' },
  CANCELLED: { variant: 'warning', key: 'statusCancelled' },
  REFUNDED: { variant: 'warning', key: 'statusRefunded' },
  EXPIRED: { variant: 'warning', key: 'statusExpired' },
};
