import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMyLikedMoviesMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getMyLikedMovies: () => getMyLikedMoviesMock() }));

const useIsAuthenticatedMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useIsAuthenticated: () => useIsAuthenticatedMock() }));

import { useMyLikedMovies } from './useMyLikedMovies';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMyLikedMovies', () => {
  beforeEach(() => {
    getMyLikedMoviesMock.mockReset();
    useIsAuthenticatedMock.mockReset();
  });

  it('is disabled when the caller is not authenticated', () => {
    useIsAuthenticatedMock.mockReturnValue(false);
    const { result } = renderHook(() => useMyLikedMovies(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches liked movies when authenticated', async () => {
    useIsAuthenticatedMock.mockReturnValue(true);
    getMyLikedMoviesMock.mockResolvedValue([{ id: 1, name: 'Movie A' }]);
    const { result } = renderHook(() => useMyLikedMovies(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyLikedMoviesMock).toHaveBeenCalled();
    expect(result.current.data).toEqual([{ id: 1, name: 'Movie A' }]);
  });
});
