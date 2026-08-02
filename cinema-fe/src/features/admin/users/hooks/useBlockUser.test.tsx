import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const blockUserMock = vi.fn();
vi.mock('../api/users.api', () => ({ blockUser: (...args: unknown[]) => blockUserMock(...args) }));

import { useBlockUser } from './useBlockUser';

describe('useBlockUser', () => {
  beforeEach(() => blockUserMock.mockReset());

  it('calls blockUser and invalidates adminUsers', async () => {
    blockUserMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useBlockUser(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(blockUserMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminUsers'] });
  });
});
