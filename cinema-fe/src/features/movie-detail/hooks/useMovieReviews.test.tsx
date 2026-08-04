import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMovieReviewsMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  getMovieReviews: (...args: unknown[]) => getMovieReviewsMock(...args),
}));

import { useMovieReviews, movieReviewsQueryKey } from './useMovieReviews';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('movieReviewsQueryKey', () => {
  it('stringifies the movie id', () => {
    expect(movieReviewsQueryKey(5)).toEqual(['movieReviews', '5']);
    expect(movieReviewsQueryKey(undefined)).toEqual(['movieReviews', undefined]);
  });
});

describe('useMovieReviews', () => {
  beforeEach(() => getMovieReviewsMock.mockReset());

  it('is disabled when movieId is undefined', () => {
    const { result } = renderHook(() => useMovieReviews(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches reviews for the movie', async () => {
    getMovieReviewsMock.mockResolvedValue({ reviews: [], average: 0, count: 0 });
    const { result } = renderHook(() => useMovieReviews(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMovieReviewsMock).toHaveBeenCalledWith(1);
  });
});
