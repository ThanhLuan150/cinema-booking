import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updateUserRoleMock = vi.fn();
vi.mock('../api/users.api', () => ({ updateUserRole: (...args: unknown[]) => updateUserRoleMock(...args) }));

import { useUpdateUserRole } from './useUpdateUserRole';

describe('useUpdateUserRole', () => {
  beforeEach(() => updateUserRoleMock.mockReset());

  it('calls updateUserRole and invalidates adminUsers', async () => {
    updateUserRoleMock.mockResolvedValue({});
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useUpdateUserRole(), { wrapper });
    result.current.mutate({ userId: 5, role: 2 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateUserRoleMock).toHaveBeenCalledWith(5, 2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminUsers'] });
  });
});
