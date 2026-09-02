import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import * as boxOfficeApi from './boxOffice.api';

describe('boxOffice.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
    postMock.mockResolvedValue({ data: {} });
  });

  it('sellAtBoxOffice posts to /box-office/sell with the Idempotency-Key header', async () => {
    const payload = {
      scheduleId: 1,
      ticketIds: [10],
      comboIds: [],
      voucherCode: null,
      promotionCode: null,
      accountId: 42,
      method: 'CASH' as const,
      cinema_id: 5,
    };
    await boxOfficeApi.sellAtBoxOffice(payload, 'idem-key-1');
    expect(postMock).toHaveBeenCalledWith('/box-office/sell', payload, {
      headers: { 'Idempotency-Key': 'idem-key-1' },
    });
  });

  it('getBoxOfficeBookingTickets gets /box-office/bookings/:id/tickets', async () => {
    await boxOfficeApi.getBoxOfficeBookingTickets(7);
    expect(getMock).toHaveBeenCalledWith('/box-office/bookings/7/tickets');
  });
});
