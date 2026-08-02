import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCinemaReviewsMock = vi.fn();
vi.mock('../api/reviews.api', () => ({ getCinemaReviews: (...args: unknown[]) => getCinemaReviewsMock(...args) }));

import { useCinemaReviews, cinemaReviewsQueryKey } from './useCinemaReviews';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('cinemaReviewsQueryKey', () => {
  it('stringifies the cinema id', () => {
    expect(cinemaReviewsQueryKey(5)).toEqual(['cinemaReviews', '5']);
    expect(cinemaReviewsQueryKey(undefined)).toEqual(['cinemaReviews', undefined]);
  });
});

describe('useCinemaReviews', () => {
  beforeEach(() => getCinemaReviewsMock.mockReset());

  it('is disabled when cinemaId is undefined', () => {
    const { result } = renderHook(() => useCinemaReviews(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches reviews for the cinema', async () => {
    getCinemaReviewsMock.mockResolvedValue({ reviews: [], average: 0, count: 0 });
    const { result } = renderHook(() => useCinemaReviews(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCinemaReviewsMock).toHaveBeenCalledWith(1);
  });
});
