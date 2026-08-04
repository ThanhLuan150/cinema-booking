import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const postMovieReviewMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  postMovieReview: (...args: unknown[]) => postMovieReviewMock(...args),
}));

import { usePostMovieReview } from './usePostMovieReview';

describe('usePostMovieReview', () => {
  beforeEach(() => postMovieReviewMock.mockReset());

  it("posts the review and invalidates that movie's reviews query", async () => {
    postMovieReviewMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { movie_id: 5, rating: 4, comment: 'Nice' } as any;
    const { result } = renderHook(() => usePostMovieReview(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postMovieReviewMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieReviews', '5'] });
  });
});
