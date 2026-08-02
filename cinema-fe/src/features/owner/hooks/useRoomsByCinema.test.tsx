import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const getRoomsByCinemaMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getRoomsByCinema: (...args: unknown[]) => getRoomsByCinemaMock(...args) }));

import { useRoomsByCinema, roomsByCinemaQueryKey } from './useRoomsByCinema';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('roomsByCinemaQueryKey', () => {
  it('stringifies the cinema id', () => {
    expect(roomsByCinemaQueryKey(5)).toEqual(['roomsByCinema', '5']);
    expect(roomsByCinemaQueryKey(undefined)).toEqual(['roomsByCinema', undefined]);
  });
});

describe('useRoomsByCinema', () => {
  beforeEach(() => getRoomsByCinemaMock.mockReset());

  it('is disabled when cinemaId is undefined', () => {
    const { result } = renderHook(() => useRoomsByCinema(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches rooms for the cinema with the full-list limit', async () => {
    getRoomsByCinemaMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useRoomsByCinema(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRoomsByCinemaMock).toHaveBeenCalledWith(5, { limit: FULL_LIST_FETCH_LIMIT });
  });
});
