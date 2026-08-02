import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyFavoriteCinemasMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getMyFavoriteCinemas: () => getMyFavoriteCinemasMock() }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useFavoriteCinemas } from './useFavoriteCinemas';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useFavoriteCinemas', () => {
  beforeEach(() => {
    getMyFavoriteCinemasMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('is disabled when the caller is not authenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    const { result } = renderHook(() => useFavoriteCinemas(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches favorite cinemas when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getMyFavoriteCinemasMock.mockResolvedValue([{ id: 1, name: 'Cinema A' }]);
    const { result } = renderHook(() => useFavoriteCinemas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyFavoriteCinemasMock).toHaveBeenCalled();
    expect(result.current.data).toEqual([{ id: 1, name: 'Cinema A' }]);
  });
});
