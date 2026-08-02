import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCurrentUserMock = vi.fn();
vi.mock('../api/auth.api', () => ({ getCurrentUser: () => getCurrentUserMock() }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useCurrentUser } from './useCurrentUser';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCurrentUser', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('is disabled when the caller is not authenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    const { result } = renderHook(() => useCurrentUser(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches and unwraps the current user when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getCurrentUserMock.mockResolvedValue({ data: { id: 1, name: 'Luan' } });
    const { result } = renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCurrentUserMock).toHaveBeenCalled();
    expect(result.current.data).toEqual({ id: 1, name: 'Luan' });
  });
});
