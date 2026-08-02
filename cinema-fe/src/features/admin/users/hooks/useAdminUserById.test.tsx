import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getUserByIdMock = vi.fn();
vi.mock('../api/users.api', () => ({ getUserById: (...args: unknown[]) => getUserByIdMock(...args) }));

import { useAdminUserById } from './useAdminUserById';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAdminUserById', () => {
  beforeEach(() => getUserByIdMock.mockReset());

  it('is disabled when id is undefined', () => {
    const { result } = renderHook(() => useAdminUserById(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the user by id', async () => {
    getUserByIdMock.mockResolvedValue({ id: 5 });
    const { result } = renderHook(() => useAdminUserById(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserByIdMock).toHaveBeenCalledWith(5);
  });
});
