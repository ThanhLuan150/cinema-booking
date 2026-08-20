import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const releaseSeatsMock = vi.fn();
vi.mock('../api/booking.api', () => ({ releaseSeats: (...args: unknown[]) => releaseSeatsMock(...args) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { useReleaseSeats } from './useReleaseSeats';

describe('useReleaseSeats', () => {
  beforeEach(() => releaseSeatsMock.mockReset());

  it('calls releaseSeats with the schedule id and seat codes', async () => {
    releaseSeatsMock.mockResolvedValue({ released: ['A1'] });
    const { result } = renderHook(() => useReleaseSeats(7), { wrapper });
    result.current.mutate(['A1']);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(releaseSeatsMock).toHaveBeenCalledWith(7, ['A1']);
  });
});
