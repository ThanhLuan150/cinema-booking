import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getUsersMock = vi.fn();
vi.mock('../api/users.api', () => ({ getUsers: (...args: unknown[]) => getUsersMock(...args) }));

import { useAdminUsers } from './useAdminUsers';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAdminUsers', () => {
  beforeEach(() => getUsersMock.mockReset());

  it('fetches users for the given page/limit', async () => {
    getUsersMock.mockResolvedValue({ data: [], total: 0 });
    const { result } = renderHook(() => useAdminUsers(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUsersMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
