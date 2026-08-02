import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const deleteRoomMock = vi.fn();
vi.mock('../api/owner.api', () => ({ deleteRoom: (...args: unknown[]) => deleteRoomMock(...args) }));

import { useDeleteRoom } from './useDeleteRoom';

describe('useDeleteRoom', () => {
  beforeEach(() => deleteRoomMock.mockReset());

  it('deletes the room and invalidates roomsByCinema', async () => {
    deleteRoomMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useDeleteRoom(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteRoomMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roomsByCinema'] });
  });
});
