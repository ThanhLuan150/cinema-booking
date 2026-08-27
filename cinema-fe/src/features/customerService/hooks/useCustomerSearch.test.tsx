import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getUsersMock = vi.fn();
vi.mock('@/features/admin/users/api/users.api', () => ({
  getUsers: (...args: unknown[]) => getUsersMock(...args),
}));

import { useCustomerSearch } from './useCustomerSearch';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCustomerSearch', () => {
  beforeEach(() => getUsersMock.mockReset());

  it('does not search when the query is empty', () => {
    const { result } = renderHook(() => useCustomerSearch(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getUsersMock).not.toHaveBeenCalled();
  });

  it('searches by the trimmed query once non-empty', async () => {
    getUsersMock.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 1 });
    const { result } = renderHook(() => useCustomerSearch('  john  '), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUsersMock).toHaveBeenCalledWith({ q: 'john', limit: 10 });
  });
});
