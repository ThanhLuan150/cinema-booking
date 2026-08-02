import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const postReviewReactionMock = vi.fn();
vi.mock('../api/reviews.api', () => ({ postReviewReaction: (...args: unknown[]) => postReviewReactionMock(...args) }));

import { useReactToCinemaReview } from './useReactToCinemaReview';

describe('useReactToCinemaReview', () => {
  beforeEach(() => postReviewReactionMock.mockReset());

  it('posts the reaction and invalidates the cinema reviews query', async () => {
    postReviewReactionMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useReactToCinemaReview(5), { wrapper });
    result.current.mutate({ reviewId: 10, type: 'like' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postReviewReactionMock).toHaveBeenCalledWith(10, 'like');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cinemaReviews', '5'] });
  });
});
