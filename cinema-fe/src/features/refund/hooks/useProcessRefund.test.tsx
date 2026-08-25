import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const processRefundMock = vi.fn();
vi.mock('../api/refund.api', () => ({ processRefund: (...args: unknown[]) => processRefundMock(...args) }));

import { useProcessRefund } from './useProcessRefund';

describe('useProcessRefund', () => {
  beforeEach(() => processRefundMock.mockReset());

  it('starts processing the refund and invalidates the adminRefunds query', async () => {
    processRefundMock.mockResolvedValue({ id: 1, status: 'PROCESSING' });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useProcessRefund(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(processRefundMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminRefunds'] });
  });
});
