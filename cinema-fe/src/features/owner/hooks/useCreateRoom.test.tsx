import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createRoomMock = vi.fn();
vi.mock('../api/owner.api', () => ({ createRoom: (...args: unknown[]) => createRoomMock(...args) }));

import { useCreateRoom } from './useCreateRoom';

describe('useCreateRoom', () => {
  beforeEach(() => createRoomMock.mockReset());

  it('creates the room and invalidates that cinema\'s rooms query', async () => {
    createRoomMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { name: 'Room 1', cinema_id: 5, code: 'R1', type: '2D', capacity: 40 };
    const { result } = renderHook(() => useCreateRoom(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createRoomMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['roomsByCinema', '5'] });
  });
});
