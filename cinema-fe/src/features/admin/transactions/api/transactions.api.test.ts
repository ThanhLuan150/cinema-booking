import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: { get: (...args: unknown[]) => getMock(...args), post: (...args: unknown[]) => postMock(...args) },
}));

import * as transactionsApi from './transactions.api';

describe('admin transactions.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getAdminInvoices gets /admin/invoices with pagination', async () => {
    await transactionsApi.getAdminInvoices({ page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/admin/invoices', { params: { page: 1 } });
  });

  it('refundInvoice posts to /invoice/:id/refund', async () => {
    await transactionsApi.refundInvoice(5);
    expect(postMock).toHaveBeenCalledWith('/invoice/5/refund');
  });
});
