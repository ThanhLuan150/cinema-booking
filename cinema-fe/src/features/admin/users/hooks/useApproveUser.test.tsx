import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const approveUserMock = vi.fn();
vi.mock('../api/users.api', () => ({ approveUser: (...args: unknown[]) => approveUserMock(...args) }));

import { useApproveUser } from './useApproveUser';

describe('useApproveUser', () => {
  beforeEach(() => approveUserMock.mockReset());

  it('calls approveUser and invalidates adminUsers', async () => {
    approveUserMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useApproveUser(), { wrapper });
    result.current.mutate(5);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(approveUserMock).toHaveBeenCalledWith(5);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminUsers'] });
  });
});
