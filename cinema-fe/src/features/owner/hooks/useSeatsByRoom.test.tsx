import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getSeatsByRoomMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getSeatsByRoom: (...args: unknown[]) => getSeatsByRoomMock(...args) }));

import { useSeatsByRoom, seatsByRoomQueryKey } from './useSeatsByRoom';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('seatsByRoomQueryKey', () => {
  it('builds a key scoped to the room id', () => {
    expect(seatsByRoomQueryKey(5)).toEqual(['seatsByRoom', 5]);
  });
});

describe('useSeatsByRoom', () => {
  beforeEach(() => getSeatsByRoomMock.mockReset());

  it('is disabled when roomId is undefined', () => {
    const { result } = renderHook(() => useSeatsByRoom(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches seats for the room', async () => {
    getSeatsByRoomMock.mockResolvedValue([{ id: 1, seat_code: 'A1' }]);
    const { result } = renderHook(() => useSeatsByRoom(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSeatsByRoomMock).toHaveBeenCalledWith(5);
  });
});
