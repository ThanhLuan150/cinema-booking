import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rejectRefundMock = vi.fn();
vi.mock('../api/refund.api', () => ({ rejectRefund: (...args: unknown[]) => rejectRefundMock(...args) }));

import { useRejectRefund } from './useRejectRefund';

describe('useRejectRefund', () => {
  beforeEach(() => rejectRefundMock.mockReset());

  it('rejects the refund with a reason and invalidates the adminRefunds query', async () => {
    rejectRefundMock.mockResolvedValue({ id: 1, status: 'REJECTED' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useRejectRefund(), { wrapper });
    result.current.mutate({ id: 1, reason: 'Not eligible' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rejectRefundMock).toHaveBeenCalledWith(1, 'Not eligible');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminRefunds'] });
  });
});
