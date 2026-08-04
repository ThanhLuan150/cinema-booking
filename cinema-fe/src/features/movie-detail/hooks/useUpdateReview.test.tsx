import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updateReviewMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  updateReview: (...args: unknown[]) => updateReviewMock(...args),
}));

import { useUpdateReview } from './useUpdateReview';

describe('useUpdateReview (movie-detail)', () => {
  beforeEach(() => updateReviewMock.mockReset());

  it('updates the review and invalidates the movie reviews query', async () => {
    updateReviewMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { rating: 5, comment: 'Great' };
    const { result } = renderHook(() => useUpdateReview(5), { wrapper });
    result.current.mutate({ reviewId: 10, payload });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateReviewMock).toHaveBeenCalledWith(10, payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieReviews', '5'] });
  });
});
