import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const failRefundMock = vi.fn();
vi.mock('../api/refund.api', () => ({ failRefund: (...args: unknown[]) => failRefundMock(...args) }));

import { useFailRefund } from './useFailRefund';

describe('useFailRefund', () => {
  beforeEach(() => failRefundMock.mockReset());

  it('marks the refund failed with a reason and invalidates the adminRefunds query', async () => {
    failRefundMock.mockResolvedValue({ id: 1, status: 'FAILED' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useFailRefund(), { wrapper });
    result.current.mutate({ id: 1, reason: 'Gateway timeout' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(failRefundMock).toHaveBeenCalledWith(1, 'Gateway timeout');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminRefunds'] });
  });
});
