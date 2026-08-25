// Ticket 13: lifecycle of a customer's issued e-ticket (Invoice.ticket_status on the backend).
// Not to be confused with constants/ticketStatus.ts, which is the seat-grid's numeric
// sold/available/held status used while a seat is still being selected/booked.
export const ISSUED_TICKET_STATUS = {
  issued: 'ISSUED',
  used: 'USED',
  cancelled: 'CANCELLED',
  refunded: 'REFUNDED',
  expired: 'EXPIRED',
} as const;

export const ISSUED_TICKET_STATUS_META: Record<string, { key: string; className: string }> = {
  [ISSUED_TICKET_STATUS.issued]: { key: 'issued', className: 'bg-green-600/20 text-green-400' },
  [ISSUED_TICKET_STATUS.used]: { key: 'used', className: 'bg-blue-500/20 text-blue-400' },
  [ISSUED_TICKET_STATUS.cancelled]: { key: 'cancelled', className: 'bg-gray-500/20 text-gray-400' },
  [ISSUED_TICKET_STATUS.refunded]: { key: 'refunded', className: 'bg-gray-500/20 text-gray-400' },
  [ISSUED_TICKET_STATUS.expired]: { key: 'expired', className: 'bg-red-500/20 text-red-400' },
};
