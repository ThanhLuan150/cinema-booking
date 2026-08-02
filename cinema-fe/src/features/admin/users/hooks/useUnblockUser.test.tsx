import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const unblockUserMock = vi.fn();
vi.mock('../api/users.api', () => ({ unblockUser: (...args: unknown[]) => unblockUserMock(...args) }));

import { useUnblockUser } from './useUnblockUser';

describe('useUnblockUser', () => {
  beforeEach(() => unblockUserMock.mockReset());

  it('calls unblockUser with the status payload and invalidates adminUsers', async () => {
    unblockUserMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useUnblockUser(), { wrapper });
    result.current.mutate({ id: 5, status: 1 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(unblockUserMock).toHaveBeenCalledWith(5, { status: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminUsers'] });
  });
});
