import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const completeRefundMock = vi.fn();
vi.mock('../api/refund.api', () => ({ completeRefund: (...args: unknown[]) => completeRefundMock(...args) }));

import { useCompleteRefund } from './useCompleteRefund';

describe('useCompleteRefund', () => {
  beforeEach(() => completeRefundMock.mockReset());

  it('completes the refund and invalidates the adminRefunds query', async () => {
    completeRefundMock.mockResolvedValue({ id: 1, status: 'COMPLETED' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useCompleteRefund(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(completeRefundMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminRefunds'] });
  });
});
