import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const generateSeatMapMock = vi.fn();
vi.mock('../api/owner.api', () => ({ generateSeatMap: (...args: unknown[]) => generateSeatMapMock(...args) }));

import { useGenerateSeatMap } from './useGenerateSeatMap';

describe('useGenerateSeatMap', () => {
  beforeEach(() => generateSeatMapMock.mockReset());

  it('generates the seat map and invalidates that room\'s seats query', async () => {
    generateSeatMapMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { rows: ['A', 'B'], seatsPerRow: 5 } as any;
    const { result } = renderHook(() => useGenerateSeatMap(), { wrapper });
    result.current.mutate({ roomId: 5, payload });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(generateSeatMapMock).toHaveBeenCalledWith(5, payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['seatsByRoom', 5] });
  });
});
