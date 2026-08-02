import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMovieByIdMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getMovieById: (...args: unknown[]) => getMovieByIdMock(...args) }));

import { useMovieDetail } from './useMovieDetail';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMovieDetail', () => {
  beforeEach(() => getMovieByIdMock.mockReset());

  it('is disabled when movieId is undefined', () => {
    const { result } = renderHook(() => useMovieDetail(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getMovieByIdMock).not.toHaveBeenCalled();
  });

  it('fetches the movie when movieId is provided', async () => {
    getMovieByIdMock.mockResolvedValue({ id: 1, name: 'Movie A' });
    const { result } = renderHook(() => useMovieDetail(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMovieByIdMock).toHaveBeenCalledWith(1);
  });
});
