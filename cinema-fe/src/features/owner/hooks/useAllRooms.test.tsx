import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const getRoomsByCinemaMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getRoomsByCinema: (...args: unknown[]) => getRoomsByCinemaMock(...args) }));

import { useAllRooms } from './useAllRooms';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAllRooms', () => {
  beforeEach(() => getRoomsByCinemaMock.mockReset());

  it('fetches every room (no cinema filter) with the full-list limit', async () => {
    getRoomsByCinemaMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useAllRooms(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRoomsByCinemaMock).toHaveBeenCalledWith(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  });
});
