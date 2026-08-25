import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const approveRefundMock = vi.fn();
vi.mock('../api/refund.api', () => ({ approveRefund: (...args: unknown[]) => approveRefundMock(...args) }));

import { useApproveRefund } from './useApproveRefund';

describe('useApproveRefund', () => {
  beforeEach(() => approveRefundMock.mockReset());

  it('approves the refund and invalidates the adminRefunds query', async () => {
    approveRefundMock.mockResolvedValue({ id: 1, status: 'APPROVED' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useApproveRefund(), { wrapper });
    result.current.mutate({ id: 1, note: 'looks good' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(approveRefundMock).toHaveBeenCalledWith(1, 'looks good');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminRefunds'] });
  });
});
