import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const holdSeatsMock = vi.fn();
vi.mock('../api/booking.api', () => ({ holdSeats: (...args: unknown[]) => holdSeatsMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useHoldSeats } from './useHoldSeats';

describe('useHoldSeats', () => {
  beforeEach(() => holdSeatsMock.mockReset());

  it('calls holdSeats with the schedule id and seat codes', async () => {
    holdSeatsMock.mockResolvedValue({ held: [{ id: 1, seat_code: 'A1', status: 2 }] });
    const { result } = renderHook(() => useHoldSeats(7), { wrapper });
    result.current.mutate(['A1']);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(holdSeatsMock).toHaveBeenCalledWith(7, ['A1']);
  });
});
