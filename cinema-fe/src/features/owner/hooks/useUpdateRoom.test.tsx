import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updateRoomMock = vi.fn();
vi.mock('../api/owner.api', () => ({ updateRoom: (...args: unknown[]) => updateRoomMock(...args) }));

import { useUpdateRoom } from './useUpdateRoom';

describe('useUpdateRoom', () => {
  beforeEach(() => updateRoomMock.mockReset());

  it('updates the room and invalidates that cinema\'s rooms query', async () => {
    updateRoomMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useUpdateRoom(5), { wrapper });
    result.current.mutate({ id: 10, name: 'New name', status: 'MAINTENANCE' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateRoomMock).toHaveBeenCalledWith(10, { name: 'New name', status: 'MAINTENANCE' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roomsByCinema', '5'] });
  });
});
