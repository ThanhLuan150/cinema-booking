import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const hideReviewMock = vi.fn();
const deleteReviewMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  hideReview: (...args: unknown[]) => hideReviewMock(...args),
  deleteReview: (...args: unknown[]) => deleteReviewMock(...args),
}));

import { useHideReview, useDeleteReview } from './useReviewModeration';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('review moderation hooks', () => {
  beforeEach(() => {
    hideReviewMock.mockReset();
    deleteReviewMock.mockReset();
  });

  it('useHideReview calls hideReview and invalidates adminReviews', async () => {
    hideReviewMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useHideReview(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hideReviewMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminReviews'] });
  });

  it('useDeleteReview calls deleteReview and invalidates adminReviews', async () => {
    deleteReviewMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteReview(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteReviewMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminReviews'] });
  });
});
