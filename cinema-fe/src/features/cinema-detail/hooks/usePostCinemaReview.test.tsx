import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const postCinemaReviewMock = vi.fn();
vi.mock('../api/reviews.api', () => ({ postCinemaReview: (...args: unknown[]) => postCinemaReviewMock(...args) }));

import { usePostCinemaReview } from './usePostCinemaReview';

describe('usePostCinemaReview', () => {
  beforeEach(() => postCinemaReviewMock.mockReset());

  it('posts the review and invalidates that cinema\'s reviews query', async () => {
    postCinemaReviewMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { cinema_id: 5, rating: 4, comment: 'Nice' } as any;
    const { result } = renderHook(() => usePostCinemaReview(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postCinemaReviewMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cinemaReviews', '5'] });
  });
});
