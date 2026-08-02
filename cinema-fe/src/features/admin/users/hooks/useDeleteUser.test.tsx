import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const deleteUserMock = vi.fn();
vi.mock('../api/users.api', () => ({ deleteUser: (...args: unknown[]) => deleteUserMock(...args) }));

import { useDeleteUser } from './useDeleteUser';

describe('useDeleteUser', () => {
  beforeEach(() => deleteUserMock.mockReset());

  it('calls deleteUser and invalidates adminUsers', async () => {
    deleteUserMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useDeleteUser(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteUserMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminUsers'] });
  });
});
