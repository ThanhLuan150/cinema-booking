import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getRoomsListMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getRoomsList: () => getRoomsListMock() }));

import { useRoomsList } from './useRoomsList';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useRoomsList', () => {
  beforeEach(() => getRoomsListMock.mockReset());

  it('is disabled when enabled=false', () => {
    const { result } = renderHook(() => useRoomsList(false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the room list by default', async () => {
    getRoomsListMock.mockResolvedValue([{ id: 1, name: 'Room 1' }]);
    const { result } = renderHook(() => useRoomsList(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRoomsListMock).toHaveBeenCalled();
  });
});
