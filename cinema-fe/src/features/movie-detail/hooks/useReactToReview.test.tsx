import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const postReviewReactionMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  postReviewReaction: (...args: unknown[]) => postReviewReactionMock(...args),
}));

import { useReactToReview } from './useReactToReview';

describe('useReactToReview', () => {
  beforeEach(() => postReviewReactionMock.mockReset());

  it('posts the reaction and invalidates the movie reviews query', async () => {
    postReviewReactionMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useReactToReview(5), { wrapper });
    result.current.mutate({ reviewId: 10, type: 'wow' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postReviewReactionMock).toHaveBeenCalledWith(10, 'wow');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieReviews', '5'] });
  });
});
