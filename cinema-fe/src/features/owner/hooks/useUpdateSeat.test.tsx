import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updateSeatMock = vi.fn();
vi.mock('../api/owner.api', () => ({ updateSeat: (...args: unknown[]) => updateSeatMock(...args) }));

import { useUpdateSeat } from './useUpdateSeat';

describe('useUpdateSeat', () => {
  beforeEach(() => updateSeatMock.mockReset());

  it('updates the seat status and invalidates seatsByRoom', async () => {
    updateSeatMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useUpdateSeat(), { wrapper });
    result.current.mutate({ id: 5, status: 'DISABLED' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateSeatMock).toHaveBeenCalledWith(5, { status: 'DISABLED' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['seatsByRoom'] });
  });
});
